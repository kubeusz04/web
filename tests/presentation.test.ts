import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archiveStatistics} from '../src/lib/presentation';
import {demoGift,blankItem,giftSchema} from '../src/lib/schema';

test('archive dates describe the actual meeting and visit; counts exclude hidden items and repeated photos',()=>{
 const gift=demoGift('archive'),section=gift.sections[0];
 Object.assign(gift,{date:'2026-11-06',firstLetterDate:'2024-02-28',firstMetDate:'2024-03-01',visitStartDate:'2025-01-01',visitEndDate:'2025-01-21'});
 const photo=crypto.randomUUID();section.items=[{...blankItem(),category:'Letter',body:'Three simple words',mediaId:photo,extraMediaIds:[photo]},{...blankItem(),category:'Letter',body:'Hidden text',hidden:true},{...blankItem(),category:'Gallery',mediaId:photo},{...blankItem(),category:'Memory',mediaId:crypto.randomUUID(),mediaKind:'audio'}];
 assert.deepEqual(archiveStatistics(gift,section).map(statistic=>statistic.value),['1','3','2','20','1']);
 gift.visitEndDate='2024-01-01';gift.firstMetDate='not a date';assert.deepEqual(archiveStatistics(gift,section).slice(2,4).map(statistic=>statistic.value),['—','—']);
});
test('custom archive statistics preserve literal text and can be removed entirely',()=>{
 const gift=demoGift('archive');gift.sections[0].statistics=[{value:'800+',label:'Photographs of our story'},{value:'<script>',label:'Literal text'}];
 const saved=giftSchema.parse(gift);assert.deepEqual(archiveStatistics(saved,saved.sections[0]),gift.sections[0].statistics);
 saved.sections[0].statistics=[];assert.deepEqual(archiveStatistics(saved,saved.sections[0]),[]);
});

test('normal mode preserves content and replaces distance statistics with everyday memories',()=>{
 const gift=demoGift('archive');gift.relationshipMode='normal';gift.firstMetDate='2024-01-01';gift.date='2024-01-11';
 gift.sections[0].items=[{...blankItem(),category:'Letter',body:'Keep these words'},{...blankItem(),category:'Date'},{...blankItem(),category:'Moment',hidden:true}];
 const saved=giftSchema.parse(gift),stats=archiveStatistics(saved,saved.sections[0]);
 assert.equal(saved.relationshipMode,'normal');assert.equal(saved.sections[0].items[0].body,'Keep these words');
 assert.deepEqual(stats.slice(0,3),[{value:'2',label:'shared moments'},{value:'1',label:'dates to remember'},{value:'10',label:'days together'}]);
 assert.ok(stats.every(stat=>!/(letter|wait)/i.test(stat.label)));
 saved.relationshipMode='ldr';assert.equal(archiveStatistics(saved,saved.sections[0])[0].label,'letters');
 delete saved.relationshipMode;assert.equal(archiveStatistics(giftSchema.parse(saved),saved.sections[0])[0].label,'letters');
});

test('appearance validates colour and font choices and merges individual page overrides',async()=>{
 const {resolvedAppearance}=await import('../src/lib/appearance');
 const gift=demoGift('archive');gift.appearance={background:'#102030',text:'#fafafa',accent:'#f0aabb',headingFont:'handwritten',bodyFont:'modern'};
 gift.sections[0].appearance={accent:'#ab12ef',headingFont:'classic'};
 const saved=giftSchema.parse(gift);assert.deepEqual(resolvedAppearance(saved,saved.sections[0]),{...gift.appearance,...gift.sections[0].appearance});
 assert.equal(giftSchema.safeParse({...gift,appearance:{background:'url(https://invalid.example)'}}).success,false);
 assert.equal(giftSchema.safeParse({...gift,appearance:{headingFont:'untrusted-font'}}).success,false);
 delete saved.sections[0].appearance;assert.deepEqual(resolvedAppearance(saved,saved.sections[0]),gift.appearance);
});
