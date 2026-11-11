import type {Gift,GiftSection} from './schema';

function days(start?:string,end?:string){
 if(!start||!end)return '—';
 const distance=(Date.parse(end)-Date.parse(start))/86400000;
 return Number.isFinite(distance)&&distance>=0?String(Math.round(distance)):'—';
}
export function archiveStatistics(gift:Gift,section:GiftSection){
 if(section.statistics)return section.statistics;
 const items=section.items.filter(item=>!item.hidden);
 const letters=items.filter(item=>['letter','list'].includes(item.category.toLowerCase()));
 const photos=new Set(items.flatMap(item=>[...(item.mediaId&&item.mediaKind==='image'?[item.mediaId]:[]),...(item.extraMediaIds||[])]));
 return [
  {value:String(letters.length),label:'letters'},
  {value:String(letters.reduce((sum,item)=>sum+item.body.trim().split(/\s+/).filter(Boolean).length,0)),label:'words written'},
  {value:days(gift.firstLetterDate,gift.firstMetDate),label:'days we waited before meeting'},
  {value:days(gift.visitStartDate||gift.firstMetDate,gift.visitEndDate),label:'days together'},
  {value:String(photos.size),label:'photographs'},
 ];
}
