const service=require('../services/recepcionesCalidad.service');
const dashboardService=require('../services/recepcionesCalidadDashboard.service');
const ctx=(req)=>({empCod:Number(req.context?.empCod),login:String(req.context?.login||'').trim()});
const run=(fn)=>async(req,res,next)=>{try{return await fn(req,res);}catch(e){if(e instanceof service.CalidadError)return res.status(e.status).json({code:e.code,message:e.message});next(e);}};
module.exports={
 dashboard:run(async(req,res)=>res.json(await dashboardService.getDashboard(ctx(req).empCod,req.query))),
 list:run(async(req,res)=>res.json(await service.list(ctx(req).empCod,req.query))),
 getOne:run(async(req,res)=>res.json(await service.getOne(ctx(req).empCod,Number(req.params.id)))),
 create:run(async(req,res)=>{const c=ctx(req);res.status(201).json(await service.create(c.empCod,c.login,req.body));}),
 update:run(async(req,res)=>{const c=ctx(req);res.json(await service.update(c.empCod,c.login,Number(req.params.id),req.body));}),
 remove:run(async(req,res)=>{const c=ctx(req);res.json(await service.remove(c.empCod,c.login,Number(req.params.id)));}),
 listPhotos:run(async(req,res)=>res.json(await service.listPhotos(ctx(req).empCod,Number(req.params.id)))),
 addPhotos:run(async(req,res)=>{const c=ctx(req);res.status(201).json(await service.addPhotos(c.empCod,c.login,Number(req.params.id),req.files||[]));}),
 getPhoto:run(async(req,res)=>{const photo=await service.getPhoto(ctx(req).empCod,Number(req.params.id),Number(req.params.photoId));res.setHeader('Content-Type',photo.mime);res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(photo.name)}`);res.setHeader('Cache-Control','private, max-age=300');res.send(photo.content);}),
 removePhoto:run(async(req,res)=>res.json(await service.removePhoto(ctx(req).empCod,Number(req.params.id),Number(req.params.photoId))))
};
