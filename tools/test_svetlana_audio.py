import importlib.util
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

FILE = Path(__file__).with_name('svetlana_audio.py')
spec = importlib.util.spec_from_file_location('svetlana_audio', FILE)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class NormalizationTests(unittest.TestCase):
    def test_stress_is_converted_not_spoken_as_plus(self):
        self.assertEqual(module.normalize_text('Это б+уква +А.'), 'Это бу́ква А.')
        self.assertEqual(module.normalize_text('з+амок'), 'за́мок')
        self.assertEqual(module.normalize_text('зам+ок'), 'замо́к')
        self.assertEqual(module.normalize_text('+ёлка'), 'ёлка')
        self.assertEqual(module.normalize_text('м+а, м+о, м+у.'), 'ма, мо, му.')
    def test_yandex_phoneme_and_isolated_vowels(self):
        self.assertEqual(module.normalize_text('[[ɨ]].'), 'Ы.')
        self.assertEqual(module.normalize_text('+а'), 'А.')
        self.assertEqual(module.normalize_text('+О.'), 'О-о-о!')
        self.assertEqual(module.normalize_text('+о', clip_id='s_o'), 'О-о-о!')
        self.assertEqual(module.normalize_text('+О, +о, +о.', clip_id='snd_o'), 'О-о-о! О-о-о! О-о-о!')
    def test_bad_markup_fails_instead_of_leaking_to_speech(self):
        for text in ['', None, '[[unknown]].', 'слово+', '+б']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                module.normalize_text(text)
    def test_cache_key_is_bank_independent_but_parameter_sensitive(self):
        a={'text':'Привет!','rate':'+0%','pitch':'+0Hz','bank':'a','id':'one'}
        b={**a,'bank':'b','id':'two'}
        self.assertEqual(module.cache_key(a), module.cache_key(b))
        self.assertNotEqual(module.cache_key(a), module.cache_key({**a,'rate':'-5%'}))
        self.assertNotEqual(module.cache_key(a), module.cache_key({**a,'text':'Пока!'}))
    def test_sources_cover_every_existing_recording_and_reused_phrase(self):
        root=FILE.resolve().parents[1]
        rows=module.collect_specs(root)
        by={game:{r['id'] for r in rows if r['bank']==game} for game in module.BANKS}
        for game in module.BANKS:
            self.assertEqual(by[game], {p.stem for p in (root/game/'audio').glob('*.mp3')})
        self.assertEqual(len(rows),650)
        for row in rows:
            self.assertNotIn('+',row['text']);self.assertNotIn('[[',row['text'])
        self.assertEqual(next(r['text'] for r in rows if r['bank']=='tsifrograd' and r['id']=='ph_p1'),'Молоде́ц!')
    def test_trim_bounds_keep_safety_margins_and_reject_bad_timings(self):
        self.assertEqual(module.trim_bounds([{'start':.1,'duration':.5}],1.8),(.02,.76))
        self.assertEqual(module.trim_bounds([],1.8),(0,1.8))
        with self.assertRaises(ValueError):module.trim_bounds([{'start':-1,'duration':.5}],1.8)

    def test_new_source_ids_do_not_require_a_legacy_julia_recording(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for bank in module.BANKS:
                (root/bank/'audio').mkdir(parents=True)
            (root/'bukvograd/src').mkdir();(root/'tsifrograd/src').mkdir();(root/'tsifrograd-lab/tts').mkdir()
            (root/'bukvograd/src/clips.json').write_text(json.dumps({'new_word':'новое сл+ово'}))
            (root/'tsifrograd/src/clips.json').write_text(json.dumps({'c_1':'Один.'}))
            (root/'tsifrograd-lab/tts/clips.json').write_text(json.dumps({'clips':{'ph_new':{'text':'Привет.','speed':1}}}))
            rows=module.collect_specs(root)
            self.assertEqual(len(rows),3)
            self.assertIn('new_word',{r['id'] for r in rows})

    def test_cache_rejects_tampered_bytes_missing_metadata_and_wrong_voice(self):
        with tempfile.TemporaryDirectory() as folder:
            cache=Path(folder);key='test-fixture'
            self.assertIsNone(module.cache_entry(cache,key))
            data=b'explicit offline cache fixture, not generated speech'
            (cache/(key+'.mp3')).write_bytes(data)
            metadata={'request_sha256':key,'voice':module.VOICE,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'duration_seconds':1}
            (cache/(key+'.json')).write_text(json.dumps(metadata))
            self.assertIsNotNone(module.cache_entry(cache,key))
            (cache/(key+'.mp3')).write_bytes(data+b'changed')
            self.assertIsNone(module.cache_entry(cache,key))
            (cache/(key+'.mp3')).write_bytes(data)
            metadata['voice']='not-the-selected-voice'
            (cache/(key+'.json')).write_text(json.dumps(metadata))
            self.assertIsNone(module.cache_entry(cache,key))

if __name__=='__main__':
    unittest.main()
