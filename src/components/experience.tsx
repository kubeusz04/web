"use client";
import type {Gift} from "@/lib/schema";
import OriginalExperience from "./original-experience";
export {ItemMedia} from "./media-view";
export default function Experience({gift,demo=false,compact=false}:{gift:Gift;demo?:boolean;compact?:boolean}){return <OriginalExperience gift={gift} demo={demo} compact={compact}/>;}
