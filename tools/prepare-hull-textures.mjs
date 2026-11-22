// Development-only asset preparation. Runtime rendering uses the generated PNGs.
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {HULL_REFERENCES,prepareHullTexture} from '../hull.js';

export const digest=data=>createHash('sha256').update(data).digest('hex');
export function textureRecipeHash(source){
  source=source.replaceAll('\r\n','\n');
  const start=source.indexOf('// Hull reference pixels are neutral grays');
  const end=source.indexOf('// Fast cardinal-only rendering',start);
  if(start<0||end<0)throw new Error('Hull texture preparation source markers are missing.');
  return digest(source.slice(start,end));
}

export async function prepareTextures({check=false}={}){
  const root=fileURLToPath(new URL('../',import.meta.url));
  const require=createRequire(import.meta.url);
  let canvas;
  try{canvas=require('@napi-rs/canvas');}
  catch(error){throw new Error('Install the optional asset tool: npm install --no-save --package-lock=false @napi-rs/canvas',{cause:error});}
  const {createCanvas,loadImage}=canvas;
  const recipeHash=textureRecipeHash(await readFile(path.join(root,'hull.js'),'utf8'));
  const manifest={version:1,recipeHash,textures:[]};
  if(!check)await mkdir(path.join(root,'assets/hull-prepared'),{recursive:true});
  for(const ref of HULL_REFERENCES){
    const source=await readFile(path.join(root,'assets',ref.file));
    const image=await loadImage(source),prepared=prepareHullTexture(image,ref,createCanvas);
    const output=prepared.toBuffer('image/png'),destination=path.join(root,'assets',ref.texture);
    if(check){
      const existing=await loadImage(destination);
      if(existing.width!==prepared.width||existing.height!==prepared.height)throw new Error(`Texture size differs: ${ref.texture}`);
      const decoded=createCanvas(existing.width,existing.height),ctx=decoded.getContext('2d');ctx.drawImage(existing,0,0);
      const actual=ctx.getImageData(0,0,existing.width,existing.height).data;
      const expected=prepared.getContext('2d').getImageData(0,0,prepared.width,prepared.height).data;
      if(!Buffer.from(actual).equals(Buffer.from(expected)))throw new Error(`Prepared pixels differ: ${ref.texture}`);
    }else await writeFile(destination,output);
    manifest.textures.push({id:ref.id,source:ref.file,file:ref.texture,rows:ref.rows,width:image.width,height:image.height,sourceHash:digest(source),textureHash:digest(check?await readFile(destination):output)});
  }
  const manifestPath=path.join(root,'assets/hull-prepared/manifest.json');
  if(check){
    const existing=JSON.parse(await readFile(manifestPath,'utf8'));
    if(JSON.stringify(existing)!==JSON.stringify(manifest))throw new Error('Prepared texture manifest is stale. Run npm run prepare:hull.');
  }else await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log(`${check?'Verified':'Prepared'} ${manifest.textures.length} hull textures.`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  await prepareTextures({check:process.argv.includes('--check')});
}
