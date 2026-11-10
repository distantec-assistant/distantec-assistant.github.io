#!/usr/bin/env python3
"""Independent, offline gate for all 650 Svetlana assets (never synthesizes).

    python3 tools/test_svetlana_assets.py
    python3 tools/test_svetlana_assets.py --compare-baseline
    SV_QA_OUT=/path/to/evidence python3 tools/test_svetlana_assets.py --jobs 4

The optional baseline is a Git revision, defaulting to the pre-migration commit.
Only the three managed audio directories and their source JSON are read. Reports
get a fresh subdirectory of SV_QA_OUT; another run's evidence is never replaced.
Decoding/non-silence is a technical check, NOT a pronunciation/listening verdict.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
from typing import TypeGuard

ROOT = Path(__file__).resolve().parents[1]
COUNTS = {"bukvograd": 523, "tsifrograd": 106, "tsifrograd-lab": 21}
VOICE = "ru-RU-SvetlanaNeural"
BASELINE = "cab11066edb45f9e64f454bb321d362514d0254d"
SHA = re.compile(r"[0-9a-f]{64}\Z")
ID = re.compile(r"[a-z0-9_]+\Z")
REQUIRED = {"source_text", "text", "rate", "pitch", "duration_seconds", "bytes",
            "sha256", "request_sha256", "word_timings", "trim"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def number(value: object, minimum: float = 0, positive: bool = False) -> TypeGuard[int | float]:
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and (value > minimum if positive else value >= minimum))


def json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def read_json(path):
    if path.is_symlink():
        raise ValueError("symlink is not a managed regular file")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=json_object,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("non-finite JSON")))


def safe_files(directory):
    """No symlink following, no recursive scan outside an explicit managed bank."""
    if directory.is_symlink():
        raise ValueError("symlink bank")
    return sorted(directory.iterdir(), key=lambda p: p.name) if directory.is_dir() else []


def probe(path):
    """Both a structural probe and a complete fatal-on-error decode, at most 4 workers."""
    result = {"path": path.relative_to(ROOT).as_posix(), "errors": []}
    try:
        if path.is_symlink() or not path.is_file():
            raise ValueError("not a managed regular MP3")
        content = path.read_bytes()
        result.update(bytes=len(content), sha256=digest(content))
        if not content:
            result["errors"].append("empty-mp3")
            return result
        proc = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                               "stream=codec_name,codec_type,sample_rate,channels,duration:format=duration",
                               "-of", "json", str(path)], capture_output=True, timeout=25, check=False)
        if proc.returncode:
            result["errors"].append("ffprobe-rejected-mp3")
            return result
        meta = json.loads(proc.stdout)
        streams = meta.get("streams", [])
        audio = [s for s in streams if s.get("codec_type") == "audio"]
        if len(audio) != 1 or any(s.get("codec_type") != "audio" for s in streams):
            result["errors"].append("expected-one-audio-stream")
        if not audio or audio[0].get("codec_name") != "mp3":
            result["errors"].append("not-mp3-codec")
        duration = float(meta.get("format", {}).get("duration", "nan"))
        result["duration_seconds"] = duration if math.isfinite(duration) else None
        if not number(duration, positive=True) or duration > 90:
            result["errors"].append("invalid-duration")
        if audio and (int(audio[0].get("channels", 0)) not in (1, 2)
                      or int(audio[0].get("sample_rate", 0)) < 8000):
            result["errors"].append("invalid-audio-format")
        # Decode every frame; silence metadata is technical evidence only.
        decoded = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-xerror",
                                  "-err_detect", "explode", "-i", str(path), "-map", "0:a:0",
                                  "-af", "volumedetect", "-f", "null", "-"],
                                 capture_output=True, timeout=35, check=False)
        if decoded.returncode:
            result["errors"].append("ffmpeg-decode-failed")
        elif re.search(rb"\[error\]|Error while|Invalid data|Header missing|overread", decoded.stderr, re.I):
            result["errors"].append("ffmpeg-corrupt-frame")
        samples = re.findall(rb"n_samples:\s*(\d+)", decoded.stderr)
        peak = re.search(rb"max_volume:\s*(-?inf|[-\d.]+) dB", decoded.stderr)
        # ffmpeg may initialize/reinitialize a filter and print n_samples: 0
        # before the final nonzero count. Inspect all filter instances.
        if not samples or max(map(int, samples)) == 0:
            result["errors"].append("no-decoded-samples")
        if peak:
            maximum = float(peak[1])
            result["max_volume_db"] = maximum if math.isfinite(maximum) else None
            if not math.isfinite(maximum) or maximum <= -90:
                result["errors"].append("digitally-silent-mp3")
        else:
            result["errors"].append("no-decoded-signal-metadata")
    except (OSError, ValueError, TypeError, subprocess.TimeoutExpired):
        result["errors"].append("probe-failed-or-timed-out")
    return result


def sources():
    b = read_json(ROOT / "bukvograd/src/clips.json")
    t = read_json(ROOT / "tsifrograd/src/clips.json")
    lab = read_json(ROOT / "tsifrograd-lab/tts/clips.json")["clips"]
    # The 13 shared legacy IDs are part of the naming contract, not guessed text.
    shared = {"ph_album", "ph_locked", "ph_next_station", "ph_pick_station",
              "ph_station_done", "ph_try_again", *(f"ph_p{i}" for i in range(1, 8))}
    if any(k not in b for k in shared) or set(t) & shared:
        raise ValueError("invalid shared-source contract")
    return {"bukvograd": b, "tsifrograd": {**t, **{k: b[k] for k in shared}},
            "tsifrograd-lab": {k: v["text"] for k, v in lab.items()}}


def compare_baseline(ref, report, fail):
    """Hash a bounded Git archive in memory; never extract it or read other paths."""
    resolved = subprocess.run(["git", "rev-parse", "--verify", ref + "^{commit}"], cwd=ROOT,
                              capture_output=True, timeout=20, check=False)
    if resolved.returncode:
        fail("invalid-baseline-revision")
        return
    commit = resolved.stdout.decode().strip()
    archive = subprocess.run(["git", "archive", "--format=tar", commit, "--",
                              *(f"{bank}/audio" for bank in COUNTS)], cwd=ROOT,
                             capture_output=True, timeout=60, check=False)
    if archive.returncode:
        fail("baseline-archive-failed")
        return
    expected = {}
    with tarfile.open(fileobj=io.BytesIO(archive.stdout), mode="r:") as tar:
        for member in tar:
            parts = Path(member.name).parts
            if member.isdir() and len(parts) == 1 and parts[0] in COUNTS:
                continue
            if len(parts) < 2 or parts[0] not in COUNTS or parts[1] != "audio":
                fail("baseline-unexpected-path")
                continue
            if member.isdir():
                continue
            if not member.isfile() or len(parts) != 3:
                fail("baseline-unexpected-entry", path=member.name)
                continue
            stream = tar.extractfile(member)
            if stream is None:
                fail("baseline-unreadable-entry", path=member.name)
                continue
            expected[member.name] = digest(stream.read())
    actual = {}
    for bank in COUNTS:
        for path in safe_files(ROOT / bank / "audio"):
            if path.is_symlink() or not path.is_file():
                fail("legacy-nonregular-file", path=path.relative_to(ROOT).as_posix())
                continue
            actual[path.relative_to(ROOT).as_posix()] = digest(path.read_bytes())
    removed = sorted(expected.keys() - actual.keys())
    added = sorted(actual.keys() - expected.keys())
    changed = sorted(k for k in actual.keys() & expected.keys() if actual[k] != expected[k])
    for code, paths in [("legacy-removed", removed), ("legacy-added", added), ("legacy-changed", changed)]:
        for path in paths:
            fail(code, path=path)
    report["baseline"] = {"commit": commit, "files_compared": len(expected),
                          "removed": removed, "added": added, "changed": changed}
    if sum(p.endswith(".mp3") for p in expected) != sum(COUNTS.values()):
        fail("baseline-clip-count")


def validate_metadata(bank, clip_id, entry, source, fail, requests, contents):
    where = {"bank": bank, "clip": clip_id}
    def bad(code):
        fail(code, **where)
    if not isinstance(entry, dict):
        bad("invalid-clip-record")
        return
    if REQUIRED - entry.keys():
        bad("missing-manifest-fields")
    if entry.get("source_text") != source:
        bad("source-text-mismatch")
    text = entry.get("text")
    if not isinstance(text, str) or not text.strip():
        bad("invalid-edge-text")
    elif "+" in text or "[[" in text or "]]" in text or "ɨ" in text:
        bad("provider-markup-in-edge-text")
    # Combining U+0301 accents are explicitly allowed; no phonetic inference.
    if bank == "bukvograd" and clip_id in {"name_o", "s_o"} and text != "О-о-о!":
        bad("missing-o-pronunciation-override")
    if bank == "bukvograd" and clip_id == "snd_o" and text != "О-о-о! О-о-о! О-о-о!":
        bad("missing-o-sequence-override")
    if isinstance(text, str) and clip_id not in {"name_o", "s_o", "snd_o"}:
        # Content invariant, not a second implementation of stress placement:
        # punctuation/case/accents may change, lexical letters must not vanish.
        plain = lambda s: re.sub(r"[^А-Яа-яЁёA-Za-z0-9]", "", s).casefold()
        if plain(text) != plain(source.replace("[[ɨ]]", "Ы")):
            bad("edge-text-lexical-content-mismatch")
    if "voice" in entry and entry["voice"] != VOICE:
        bad("clip-voice-mismatch")
    for key, unit in [("rate", "%"), ("pitch", "Hz")]:
        value = entry.get(key)
        if not isinstance(value, str) or not re.fullmatch(r"[+-]\d+" + unit, value):
            bad("invalid-" + key)
        elif abs(int(value[:-len(unit)])) > 100:
            bad("implausible-" + key)
    expected_rate = "-5%" if bank in {"tsifrograd", "tsifrograd-lab"} and clip_id.startswith("c_") else "+0%"
    if entry.get("rate") != expected_rate or entry.get("pitch") != "+0Hz":
        bad("source-parameter-mismatch")
    if not number(entry.get("duration_seconds"), positive=True) or entry.get("duration_seconds", 0) > 90:
        bad("invalid-manifest-duration")
    if type(entry.get("bytes")) is not int or entry.get("bytes", 0) <= 0:
        bad("invalid-manifest-bytes")
    for key in ["sha256", "request_sha256"]:
        if not isinstance(entry.get(key), str) or not SHA.fullmatch(entry[key]):
            bad("invalid-" + key)
    if all(isinstance(entry.get(k), str) for k in ["text", "rate", "pitch", "request_sha256"]):
        signature = (VOICE, entry["text"], entry["rate"], entry["pitch"])
        request = entry["request_sha256"]
        # Independent serialization of the published v1 cache identity. Do not
        # import the generator or trust its own verification/cache helper.
        payload = dict(voice=VOICE, text=entry["text"], rate=entry["rate"], pitch=entry["pitch"],
                       volume="+0%", boundary="WordBoundary", trim_revision=1)
        calculated = digest(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode())
        if request != calculated:
            bad("request-sha256-mismatch")
        if request in requests and requests[request] != signature:
            bad("request-hash-identity-conflict")
        requests[request] = signature
        if signature in contents and contents[signature] != request:
            bad("identical-request-hash-mismatch")
        contents[signature] = request
    timings = entry.get("word_timings")
    if not isinstance(timings, list) or not timings:
        bad("missing-word-timings")
    else:
        last = -1
        for timing in timings:
            if (not isinstance(timing, dict) or not isinstance(timing.get("text"), str)
                    or not timing.get("text", "").strip()
                    or not number(timing.get("start")) or not number(timing.get("duration"), positive=True)):
                bad("invalid-word-timing")
                break
            if timing["start"] < last:
                bad("unordered-word-timings")
                break
            last = timing["start"]
    trim = entry.get("trim")
    if not isinstance(trim, dict) or not trim:
        bad("invalid-trim-metadata")
    else:
        # Units/field names belong to the producer; every provided numeric value
        # must nevertheless be finite and nonnegative, including nested values.
        def check_numbers(value):
            if isinstance(value, dict):
                return all(check_numbers(v) for v in value.values())
            if isinstance(value, list):
                return all(check_numbers(v) for v in value)
            return number(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else True
        if not check_numbers(trim):
            bad("invalid-trim-number")
        start, end = trim.get("start_seconds"), trim.get("end_seconds")
        if (not number(start) or not number(end, positive=True) or end <= start
                or type(trim.get("revision")) is not int or trim["revision"] != 1):
            bad("invalid-trim-bounds-or-revision")
        elif number(entry.get("duration_seconds"), positive=True):
            if abs(float(entry["duration_seconds"]) - (float(end) - float(start))) > 0.15:
                bad("trim-duration-mismatch")
            valid_words = [w for w in (timings or []) if isinstance(w, dict)
                           and number(w.get("start")) and number(w.get("duration"), positive=True)]
            if valid_words and (float(start) > min(w["start"] for w in valid_words) + 0.02
                                or float(end) + 0.1 < max(w["start"] + w["duration"] for w in valid_words)):
                bad("trim-cuts-word-timing")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--jobs", type=int, default=4, choices=range(1, 5))
    parser.add_argument("--compare-baseline", nargs="?", const=BASELINE, metavar="GIT_REVISION")
    args = parser.parse_args()
    out = Path(os.environ.get("SV_QA_OUT", "/root/.hermes/cache/scratch/svetlana-migration"))
    out.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix="assets-", dir=out))
    report = {"schema": 1, "result": "RED", "expected_clips": sum(COUNTS.values()), "baseline_requested": bool(args.compare_baseline),
              "banks": {}, "errors": [], "decoded": [],
              "limitations": ["No synthesis or network calls are made.",
                              "Hashes and decode/non-silence do not verify pronunciation, naturalness, or child usability.",
                              "request_sha256 is independently recomputed from the v1 request identity, not proof of provider provenance."]}
    def fail(code, **data):
        report["errors"].append({"code": code, **data})
    try:
        for exe in ["ffprobe", "ffmpeg"]:
            if not shutil.which(exe):
                fail("missing-dependency", executable=exe)
        expected_sources = sources()
        paths, entries = [], {}
        requests, contents = {}, {}
        for bank, count in COUNTS.items():
            legacy = safe_files(ROOT / bank / "audio")
            legacy_ids = {p.stem for p in legacy if p.suffix == ".mp3"}
            source = expected_sources[bank]
            if len(legacy_ids) != count or set(source) != legacy_ids:
                fail("legacy-source-identifier-contract", bank=bank)
            directory = ROOT / bank / "audio-svetlana"
            items = safe_files(directory)
            new = {p.stem: p for p in items if p.suffix == ".mp3"}
            missing, extra = sorted(legacy_ids - new.keys()), sorted(new.keys() - legacy_ids)
            report["banks"][bank] = {"expected": count, "legacy": len(legacy_ids),
                                      "sources": len(source), "new": len(new),
                                      "missing": missing, "extra": extra}
            if not directory.is_dir():
                fail("missing-bank", bank=bank, missing_clips=len(missing))
            elif missing:
                fail("missing-clips", bank=bank, count=len(missing))
            if extra:
                fail("extra-clips", bank=bank, count=len(extra))
            for path in items:
                if path.name != "manifest.json" and (path.suffix != ".mp3" or not path.is_file()):
                    fail("unexpected-bank-entry", bank=bank, path=path.name)
                if path.suffix == ".mp3" and not ID.fullmatch(path.stem):
                    fail("invalid-clip-identifier", bank=bank, path=path.name)
            paths.extend(new.values())  # Also decode unexpected MP3s; never hide corruption.
            manifest_path = directory / "manifest.json"
            if not manifest_path.is_file():
                fail("missing-manifest", bank=bank)
                continue
            try:
                manifest = read_json(manifest_path)
                if not isinstance(manifest, dict):
                    raise ValueError("not object")
                for key, value in [("schema", 1), ("provider", "edge-tts"), ("voice", VOICE),
                                   ("bank", bank), ("complete", True)]:
                    if type(manifest.get(key)) is not type(value) or manifest.get(key) != value:
                        fail("manifest-contract", bank=bank, field=key)
                clips = manifest.get("clips")
                if not isinstance(clips, dict):
                    raise ValueError("clips not object")
                if set(clips) != legacy_ids or set(clips) != new.keys():
                    fail("manifest-identifier-coverage", bank=bank,
                         missing=sorted(legacy_ids - clips.keys()), extra=sorted(clips.keys() - legacy_ids))
                for clip_id, entry in clips.items():
                    if clip_id not in source:
                        continue
                    validate_metadata(bank, clip_id, entry, source[clip_id], fail, requests, contents)
                    if isinstance(entry, dict):
                        entries[f"{bank}/audio-svetlana/{clip_id}.mp3"] = entry
            except (ValueError, OSError, KeyError, TypeError):
                fail("unreadable-or-invalid-manifest", bank=bank)
        if all(shutil.which(exe) for exe in ["ffprobe", "ffmpeg"]):
            with ThreadPoolExecutor(max_workers=args.jobs) as pool:
                for item in pool.map(probe, paths):
                    report["decoded"].append(item)
                    for code in item["errors"]:
                        fail(code, path=item["path"])
                    entry = entries.get(item["path"])
                    if entry:
                        for key in ["sha256", "bytes"]:
                            if item.get(key) != entry.get(key):
                                fail("file-" + key + "-mismatch", path=item["path"])
                        duration = item.get("duration_seconds")
                        recorded = entry.get("duration_seconds")
                        if number(duration, positive=True) and number(recorded, positive=True):
                            if abs(float(duration) - float(recorded)) > max(0.06, float(duration) * 0.01):
                                fail("file-duration-mismatch", path=item["path"])
        if args.compare_baseline:
            compare_baseline(args.compare_baseline, report, fail)
    except (ValueError, KeyError, OSError, TypeError, subprocess.TimeoutExpired):
        fail("input-contract-or-baseline-failure")
    report["decoded_count"] = len(report["decoded"])
    report["valid_mp3_count"] = sum(not p["errors"] for p in report["decoded"])
    if report["decoded_count"] != report["expected_clips"]:
        fail("decoded-count", expected=report["expected_clips"], actual=report["decoded_count"])
    report["result"] = "PASS" if not report["errors"] else "RED"
    (run / "assets-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    summary = {k: report[k] for k in ["result", "expected_clips", "decoded_count", "valid_mp3_count"]}
    summary.update(error_counts=dict(Counter(e["code"] for e in report["errors"])), report=str(run / "assets-report.json"))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
