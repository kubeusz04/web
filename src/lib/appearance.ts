import type { Appearance, Gift, GiftSection } from './schema';

export const fontChoices = {
  editorial: {label: 'Editorial · Cormorant Garamond', family: '"Cormorant Garamond",Georgia,serif'},
  modern: {label: 'Modern · Inter', family: 'Inter,system-ui,sans-serif'},
  handwritten: {label: 'Handwritten · Caveat', family: 'Caveat,"Segoe Script",cursive'},
  classic: {label: 'Classic · Georgia', family: 'Georgia,"Times New Roman",serif'},
  playful: {label: 'Playful · Fredoka', family: 'Fredoka,Nunito,sans-serif'},
  mono: {label: 'Typewriter · monospace', family: '"Courier New",monospace'},
} as const;

export function resolvedAppearance(gift: Gift, section?: GiftSection): Appearance {
  return {...gift.appearance, ...section?.appearance};
}

// Called for both the main presentation and its nested universe document.
export function applyAppearance(doc: Document, gift: Gift, section?: GiftSection, menu = false) {
  const style = doc.documentElement.style;
  const appearance = resolvedAppearance(gift, section);
  const palette = gift.theme === 'forest' ? {accent:'#8bc69a',secondary:'#85c6ad',highlight:'#dce4ac'}
    : gift.theme === 'rose' ? {accent:'#ff6f8d',secondary:'#c4b0eb',highlight:'#e8b9d5'} : {};
  const colours = {...palette, ...appearance};
  for (const key of ['--ink','--ink-2','--cream','--rose','--pink','--pink-soft','--pink-mist','--gold','--sea','--green','--fade','--faint','--ink-soft','--line','--gift-background','--gift-text']) style.removeProperty(key);
  const set = (keys: string[], value?: string) => {if(value)for(const key of keys)style.setProperty(key,value);};
  set(['--rose','--pink'],colours.accent);
  if(!appearance.accent && gift.theme==='forest')set(['--pink'],'#a5d9b7');
  if(!appearance.accent && gift.theme==='rose')set(['--pink'],'#fba0b5');
  set(['--sea','--green'],colours.secondary);
  set(['--gold','--pink-soft'],colours.highlight);
  set(['--gift-background', '--ink'],appearance.background);
  if(appearance.background)set(['--ink-2'],appearance.background);
  set(['--gift-text', '--cream'],appearance.text);
  if(appearance.text){
    set(['--fade','--ink-soft'],appearance.text+'b3');
    set(['--faint'],appearance.text+'80');
    set(['--line'],appearance.text+'26');
  }
  if(appearance.accent)set(['--pink-mist'],appearance.accent+'18');
  style.setProperty('--serif',fontChoices[appearance.headingFont || gift.font].family);
  style.setProperty('--sans',fontChoices[appearance.bodyFont || 'modern'].family);
  if(appearance.headingFont)style.setProperty('--script',fontChoices[appearance.headingFont].family);
  else style.removeProperty('--script');
  doc.documentElement.toggleAttribute('data-custom-heading',!!appearance.headingFont || gift.font==='modern');
  doc.documentElement.toggleAttribute('data-custom-body',!!appearance.bodyFont);
  // The archive reveal declares its own variables on body; explicit choices
  // must keep working after that transition and reset when changing pages.
  for(const key of ['--ink','--ink-2','--cream','--rose','--pink','--pink-soft','--gold','--sea','--green','--fade','--faint','--line']) {
    doc.body.style.removeProperty(key);
    if(style.getPropertyValue(key))doc.body.style.setProperty(key,style.getPropertyValue(key));
  }
  doc.body.style.removeProperty('background');
  if(appearance.background)doc.body.style.setProperty('background',appearance.background);
}
