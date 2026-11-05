// Re-encode locally: one JPEG, no original filename or EXIF metadata is sent.
export async function prepareReportPhoto(file) {
 if(!file || !file.type.startsWith('image/'))throw Error('请选择一张图片。');
 if(file.size>25*1024*1024)throw Error('原图超过25 MB，请选择较小的图片。');
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>100000000)throw Error('图片尺寸过大，请选择较小的图片。');
  const ratio=Math.min(1,1280/img.naturalWidth,1280/img.naturalHeight),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  for(const quality of [.85,.7,.5]){
   const data=canvas.toDataURL('image/jpeg',quality);
   if(data.length<=1398127)return data;
  }
  throw Error('图片压缩后仍过大，请选择较小的图片。');
 }catch(e){throw Error(e.message.includes('图片')?e.message:'无法读取图片，请改用 JPG、PNG 或系统相机照片。');}
 finally{URL.revokeObjectURL(url);}
}
