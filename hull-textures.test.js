import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HULL_REFERENCES} from './hull.js';
import {digest,textureRecipeHash} from './tools/prepare-hull-textures.mjs';

test('prepared hull textures match the current references, recipe, and checked-in PNGs',()=>{
  const manifest=JSON.parse(readFileSync('assets/hull-prepared/manifest.json','utf8'));
  assert.equal(manifest.version,1);
  assert.equal(manifest.recipeHash,textureRecipeHash(readFileSync('hull.js','utf8')));
  assert.equal(manifest.textures.length,HULL_REFERENCES.length);
  for(const [i,ref] of HULL_REFERENCES.entries()){
    const entry=manifest.textures[i],source=readFileSync('assets/'+ref.file),texture=readFileSync('assets/'+ref.texture);
    assert.equal(entry.id,ref.id);assert.equal(entry.source,ref.file);assert.equal(entry.file,ref.texture);
    assert.deepEqual(entry.rows,ref.rows);
    assert.equal(entry.sourceHash,digest(source),`Source changed: ${ref.file}. Run npm run prepare:hull.`);
    assert.equal(entry.textureHash,digest(texture),ref.texture);
    assert.equal(texture.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(texture.readUInt32BE(16),entry.width);assert.equal(texture.readUInt32BE(20),entry.height);
    assert.equal(entry.width,source.readUInt32BE(16));assert.equal(entry.height,source.readUInt32BE(20));
    assert.equal(texture[25],6,'prepared artwork must retain an RGBA channel');
  }
});
