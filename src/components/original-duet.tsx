"use client";
import {useEffect, useRef, useState} from "react";
import type {Gift, GiftItem} from "@/lib/schema";

export default function OriginalDuet({gift,item,take,onRecordAgain}: {gift:Gift;item:GiftItem;take?:Blob;onRecordAgain:()=>void}) {
  const [url,setUrl]=useState(""), [playing,setPlaying]=useState([false,false]), [error,setError]=useState("");
  const mine=useRef<HTMLAudioElement>(null), theirs=useRef<HTMLAudioElement>(null);
  const ownerAudio=item.mediaKind==='audio'&&item.mediaId ? `/api/media/${item.mediaId}` : '';
  useEffect(()=>{if(!take){setUrl('');return;}const next=URL.createObjectURL(take);setUrl(next);return()=>URL.revokeObjectURL(next);},[take]);
  const lines=(item.quote||'').split('\n').filter(Boolean);
  const voices=[{name:gift.to,src:url,ref:mine,who:'hers'},{name:gift.from,src:ownerAudio,ref:theirs,who:'his'}];
  async function playBoth(){setError('');const elements=[mine.current,theirs.current].filter((node):node is HTMLAudioElement=>!!node);for(const audio of elements)audio.currentTime=0;const results=await Promise.allSettled(elements.map(audio=>audio.play()));if(results.some(result=>result.status==='rejected'))setError('Use the individual audio controls to play each voice.');}
  return <>
    <div className="duet" aria-label="Your voices together">
      {voices.map((voice,i)=><div key={voice.who} className={`duet__side${playing[i]?' live':''}`} data-who={voice.who}>
        <span className="duet__name">{voice.name}</span>
        <div className="wave" aria-hidden="true">{Array.from({length:24},(_,n)=><span key={n} style={{height:`${20+(n*17)%65}%`}}/>)}</div>
        {!voice.src?<p className="footnote">{i===0?'Typed and sealed.':'No recording added.'}</p>:null}
      </div>)}
      {url||ownerAudio?<details className="duet-controls"><summary>Individual audio controls</summary>{voices.map((voice,i)=>voice.src?<label key={voice.who}>{voice.name}<audio ref={voice.ref} aria-label={`${voice.name}'s voice`} src={voice.src} controls preload="metadata" onPlay={()=>setPlaying(old=>old.map((value,n)=>n===i?true:value))} onPause={()=>setPlaying(old=>old.map((value,n)=>n===i?false:value))} onEnded={()=>setPlaying(old=>old.map((value,n)=>n===i?false:value))}/></label>:null)}</details>:null}
    </div>
    {lines.length?<div className="lines">{lines.map((line,i)=><p key={i} className={`on${i===lines.length-1?' script__punch':''}`}>{line}</p>)}</div>:null}
    <div className="actions">{url||ownerAudio?<button className="pill solid" onClick={()=>{if(playing.some(Boolean)){mine.current?.pause();theirs.current?.pause();}else void playBoth();}}>{playing.some(Boolean)?'Pause voices':url&&ownerAudio?'Play both again':'Play recording'}</button>:null}<button className="pill" onClick={onRecordAgain}>Record again</button></div>
    <p className="footnote">{error || (url?'Your take is sealed for this visit. Leaving this gift clears your recording.':'You opened this with the typed phrase. You can add your voice too.')}</p>
  </>;
}
