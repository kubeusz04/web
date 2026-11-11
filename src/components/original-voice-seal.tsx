"use client";
import {useEffect,useRef,useState} from "react";
export default function OriginalVoiceSeal({onAccept}:{onAccept:(blob:Blob)=>void}) {
 const [recording,setRecording]=useState(false),[url,setUrl]=useState(''),[error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),holding=useRef(false),pending=useRef(false),alive=useRef(true),blobUrl=useRef(''),take=useRef<Blob|null>(null),started=useRef(0);
 const release=()=>{holding.current=false;if(recorder.current?.state==='recording')recorder.current.stop();setRecording(false);};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;holding.current=false;if(recorder.current){recorder.current.onstop=null;recorder.current.ondataavailable=null;if(recorder.current.state==='recording')recorder.current.stop();}stream.current?.getTracks().forEach(track=>track.stop());if(blobUrl.current)URL.revokeObjectURL(blobUrl.current);};},[]);
 async function begin(){
  if(pending.current||recorder.current?.state==='recording')return;
  holding.current=true;pending.current=true;setError('');
  if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){setError('Recording is unavailable. Type the phrase below instead.');holding.current=false;pending.current=false;return;}
  try {
   const source=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!holding.current||!alive.current){source.getTracks().forEach(track=>track.stop());return;}
   stream.current=source;
   const next=new MediaRecorder(source),chunks:BlobPart[]=[];recorder.current=next;
   next.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
   next.onstop=()=>{source.getTracks().forEach(track=>track.stop());if(!alive.current)return;setRecording(false);if(performance.now()-started.current<1800||!chunks.length){setError('A little longer — hold the seal and say all your lines.');return;}take.current=new Blob(chunks,{type:next.mimeType});if(blobUrl.current)URL.revokeObjectURL(blobUrl.current);blobUrl.current=URL.createObjectURL(take.current);setUrl(blobUrl.current);};
   started.current=performance.now();next.start();setRecording(true);
  }catch{stream.current?.getTracks().forEach(track=>track.stop());if(alive.current){setError('Microphone access is unavailable. You can always type the phrase below.');setRecording(false);}holding.current=false;}finally{pending.current=false;}
 }
 return <div><p className="hint">Hold the seal, say your words, then let go. Your recording stays in this browser and is not uploaded.</p><button type="button" className={`seal${recording?' recording':''}`} aria-label="Hold to record" onPointerDown={event=>{if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);void begin();}} onPointerUp={release} onPointerCancel={release} onBlur={release} onKeyDown={event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();void begin();}}} onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();release();}}}><span className="seal__ring"/><span className="seal__wax">{recording?'rec':'hold'}</span></button>{error?<p className="status" role="status">{error}</p>:null}{url?<div className="actions"><audio aria-label="Preview your recording" src={url} controls preload="metadata"/><button className="pill solid" onClick={()=>{if(take.current)onAccept(take.current);}}>Seal this recording →</button><p className="footnote">This records your voice; it does not recognise spoken words. You can also use the typed answer.</p></div>:null}</div>;
}
