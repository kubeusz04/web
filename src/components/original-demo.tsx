"use client";
import Link from 'next/link';
import Experience from './experience';
import {demoGift} from '@/lib/schema';

const gift=demoGift('film');
gift.title='Our anniversary';
gift.signature='Always where you are';
gift.sections=(['film','archive','cosmos','surprise'] as const).map((type,index)=>{
 const section=demoGift(type).sections[0];
 section.id=`00000000-0000-4000-8001-${String(index+1).padStart(12,'0')}`;
 section.subtitle={film:'The film — our memories, letters and a promise',archive:'Our timeline, letters, reasons and little things',cosmos:'The sky — stars, planets and places we will go',surprise:'One more thing, sealed just for you'}[type];
 section.items.forEach((item,i)=>{item.id=`00000000-0000-4000-8001-${String((index+1)*100+i).padStart(12,'0')}`;});
 return section;
});
export default function OriginalDemo(){return <main className="recipient-page original-demo-page"><div className="original-demo-notice">Fictional demo · Surprise answer: tea <Link href="/auth">Create your own →</Link></div><h1 className="sr-only">The original gift presentation — fictional demo</h1><Experience gift={gift} demo/></main>;}
