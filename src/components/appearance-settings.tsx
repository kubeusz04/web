"use client";
import { Field } from './ui';
import { fontChoices } from '@/lib/appearance';
import type { Appearance } from '@/lib/schema';

const colourFields = [
  ['background','Background','#07070b'],
  ['text','Text','#f6efe4'],
  ['accent','Main accent','#ff6f8d'],
  ['secondary','Secondary accent','#85c6ad'],
  ['highlight','Highlights','#f0c37a'],
] as const;

export default function AppearanceSettings({value, onChange, inherited, page = false}: {
  value?: Appearance; inherited?: Appearance; page?: boolean;
  onChange: (value: Appearance | undefined) => void;
}) {
  const change = (key: keyof Appearance, next: string) => {
    const result = {...value, [key]:next};
    if(!next)delete result[key];
    onChange(Object.keys(result).length ? result : undefined);
  };
  return <div className="appearance-settings">
    <p className="small muted">{page ? 'Leave a setting on Inherit to use the gift style. Customise this page independently below.' : 'Custom colours override the palette. Fonts are hosted locally or supplied by your device.'}</p>
    {(['headingFont','bodyFont'] as const).map(key=><Field key={key} label={key==='headingFont'?'Heading font':'Body font'}>
      <select value={value?.[key] || ''} onChange={event=>change(key,event.target.value)}>
        <option value="">{page ? 'Inherit gift font' : 'Use original font'}</option>
        {Object.entries(fontChoices).map(([id,font])=><option value={id} key={id}>{font.label}</option>)}
      </select>
    </Field>)}
    <div className="appearance-colours">{colourFields.map(([key,label,fallback])=><div key={key} className="appearance-colour">
      <Field label={`${label} colour`}><input type="color" value={value?.[key] || inherited?.[key] || fallback} onChange={event=>change(key,event.target.value)}/></Field>
      <span className="small muted">{value?.[key] || (page ? 'Inherit' : 'Palette default')}</span>
      {value?.[key] ? <button type="button" className="button ghost" aria-label={`Reset ${label.toLowerCase()} colour`} onClick={()=>change(key,'')}>Reset</button> : null}
    </div>)}</div>
    <div className="appearance-sample" style={{background:value?.background||inherited?.background||'#07070b',color:value?.text||inherited?.text||'#f6efe4',borderColor:value?.accent||inherited?.accent||'#ff6f8d'}}>
      <strong style={{fontFamily:fontChoices[value?.headingFont||inherited?.headingFont||'editorial'].family}}>A little more us.</strong>
      <p style={{fontFamily:fontChoices[value?.bodyFont||inherited?.bodyFont||'modern'].family}}>Our favourite moments, in our own style.</p>
    </div>
    {value && Object.keys(value).length ? <button type="button" className="button ghost" onClick={()=>onChange(undefined)}>{page ? 'Reset page to gift style' : 'Reset custom colours and fonts'}</button> : null}
  </div>;
}
