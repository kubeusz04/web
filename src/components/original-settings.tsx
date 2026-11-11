"use client";
import { Field } from "./ui";
import {
  sceneTypes,
  type Gift,
  type GiftItem,
  type GiftSection,
} from "@/lib/schema";
type Media = { id: string; mime: string; bytes: number; state?: string };
function MediaSelect({
  label,
  value,
  files,
  onChange,
  kind = "image",
}: {
  label: string;
  value?: string | null;
  files: Media[];
  onChange: (id: string | null) => void;
  kind?: string;
}) {
  return (
    <Field label={label}>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">None</option>
        {files
          .filter(
            (file) =>
              file.mime.startsWith(kind + "/") &&
              (!file.state || file.state === "ready"),
          )
          .map((file, i) => (
            <option value={file.id} key={file.id}>
              File {i + 1} · {file.mime} · {(file.bytes / 1048576).toFixed(1)}{" "}
              MB
            </option>
          ))}
      </select>
    </Field>
  );
}
export function GiftSettings({
  gift,
  files,
  onChange,
}: {
  gift: Gift;
  files: Media[];
  onChange: (change: Partial<Gift>) => void;
}) {
  return (
    <div className="original-settings">
      <h3>Original presentation</h3>
      <Field label="Relationship style">
        <select value={gift.relationshipMode || "ldr"} onChange={event => onChange({relationshipMode: event.target.value as "ldr" | "normal"})}>
          <option value="ldr">LDR — long-distance relationship</option>
          <option value="normal">Normal — everyday life together</option>
        </select>
      </Field>
      <p className="small muted">LDR includes letters and time apart. Normal celebrates dates, shared moments and everyday life together.</p>
      <Field label="Subtitle / translation">
        <textarea
          value={gift.subtitle || ""}
          maxLength={500}
          rows={2}
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </Field>
      <Field label="Signature / closing phrase">
        <input
          value={gift.signature || ""}
          maxLength={500}
          onChange={(e) => onChange({ signature: e.target.value })}
        />
      </Field>
      <div className="form-row">
        <Field label="Your location">
          <input
            value={gift.fromLocation || ""}
            maxLength={160}
            onChange={(e) => onChange({ fromLocation: e.target.value })}
          />
        </Field>
        <Field label="Their location">
          <input
            value={gift.toLocation || ""}
            maxLength={160}
            onChange={(e) => onChange({ toLocation: e.target.value })}
          />
        </Field>
      </div>
      <Field label={gift.relationshipMode === 'normal' ? 'First message date' : 'First letter / first message date'}><input type="date" value={gift.firstLetterDate||''} onChange={e=>onChange({firstLetterDate:e.target.value})}/></Field>
      <Field label="First meeting date">
        <input
          type="date"
          value={gift.firstMetDate || ""}
          onChange={(e) => onChange({ firstMetDate: e.target.value })}
        />
      </Field>
      <div className="form-row"><Field label="Start of your visit"><input type="date" value={gift.visitStartDate||''} onChange={e=>onChange({visitStartDate:e.target.value})}/></Field><Field label="End of your visit"><input type="date" value={gift.visitEndDate||''} onChange={e=>onChange({visitEndDate:e.target.value})}/></Field></div>
      <details><summary>Words in the heart-and-particles finale</summary>{Array.from({length:4},(_,i)=><Field label={`Finale phrase ${i+1}`} key={i}><textarea rows={2} maxLength={300} value={gift.finaleWords?.[i]||''} onChange={e=>{const values=Array.from({length:4},(_,n)=>gift.finaleWords?.[n]||'');values[i]=e.target.value;onChange({finaleWords:values});}}/></Field>)}</details>
      <MediaSelect
        label="Your portrait"
        files={files}
        value={gift.fromPortraitId}
        onChange={(fromPortraitId) => onChange({ fromPortraitId })}
      />
      <MediaSelect
        label="Their portrait"
        files={files}
        value={gift.toPortraitId}
        onChange={(toPortraitId) => onChange({ toPortraitId })}
      />
      <MediaSelect
        label="Background music"
        files={files}
        value={gift.musicId}
        kind="audio"
        onChange={(musicId) => onChange({ musicId })}
      />
      <p className="small muted">
        Upload files from Your story first. Use music and photographs you have
        permission to share.
      </p>
    </div>
  );
}
export function SectionSettings({
  section,
  onChange,
  normal = false,
}: {
  section: GiftSection;
  onChange: (change: Partial<GiftSection>) => void;
  normal?: boolean;
}) {
  return (
    <details className="original-settings">
      <summary>Opening, subtitles and section headings</summary>
      <Field label="Section subtitle">
        <input
          value={section.subtitle || ""}
          maxLength={500}
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </Field>
      <Field label="Opening title">
        <input
          value={section.gateTitle || ""}
          maxLength={160}
          onChange={(e) => onChange({ gateTitle: e.target.value })}
        />
      </Field>
      <Field label="Opening message">
        <textarea
          value={section.introduction || ""}
          maxLength={4000}
          rows={4}
          onChange={(e) => onChange({ introduction: e.target.value })}
        />
      </Field>
      <Field label="Opening button text">
        <input
          value={section.gateButton || ""}
          maxLength={80}
          onChange={(e) => onChange({ gateButton: e.target.value })}
        />
      </Field>
      {section.type==='surprise'?<label className="check-label"><input type="checkbox" checked={section.voiceEnabled??true} onChange={e=>onChange({voiceEnabled:e.target.checked})}/>Allow a local voice recording; typing remains available</label>:null}
      {section.type === "archive" ? (
        <>
          <label className="check-label"><input type="checkbox" checked={section.revealEnabled??true} onChange={e=>onChange({revealEnabled:e.target.checked})}/>Enable the reveal effect</label>
          <p className="small muted">Turn off to open the archive immediately, without the introduction or scratch layer.</p>
          <details><summary>Archive statistics</summary>
            <label className="check-label"><input type="checkbox" checked={section.statistics===undefined} onChange={e=>onChange({statistics:e.target.checked?undefined:[{label:'Our story in numbers',value:'1'}]})}/>{normal ? 'Calculate statistics from my moments, dates and photographs' : 'Calculate statistics from my letters, dates and photographs'}</label>
            {section.statistics?.map((statistic,index)=><div className="detail-row" key={index}>
              <Field label={`Statistic ${index+1} value`}><input maxLength={160} value={statistic.value} onChange={e=>onChange({statistics:section.statistics!.map((old,n)=>n===index?{...old,value:e.target.value}:old)})}/></Field>
              <Field label={`Statistic ${index+1} label`}><input maxLength={300} value={statistic.label} onChange={e=>onChange({statistics:section.statistics!.map((old,n)=>n===index?{...old,label:e.target.value}:old)})}/></Field>
              <button type="button" className="text-link" disabled={index===0} aria-label={`Move statistic ${index+1} up`} onClick={()=>{const values=[...section.statistics!];[values[index-1],values[index]]=[values[index],values[index-1]];onChange({statistics:values});}}>↑</button>
              <button type="button" className="text-link danger" onClick={()=>onChange({statistics:section.statistics!.filter((_,n)=>n!==index)})}>Remove statistic</button>
            </div>)}
            {section.statistics?<button type="button" className="text-link" disabled={section.statistics.length>=12} onClick={()=>onChange({statistics:[...section.statistics!,{value:'',label:''}]})}>Add statistic</button>:<p className="small muted">Dates come from The basics. Missing or reversed date ranges display a dash. Custom statistics can include your own numbers, labels and order.</p>}
          </details>
          {(
            ["timeline", "letters", "reasons", "jokes", "gallery"] as const
          ).map((key) => (
            <Field
              label={`Heading · ${normal && key === 'letters' ? 'moments' : key}`}
              key={key}
              hint="Leave empty to calculate counts from your content."
            >
              <input
                value={section.headingLabels?.[key] || ""}
                maxLength={160}
                onChange={(e) =>
                  onChange({
                    headingLabels: {
                      timeline: "",
                      letters: "",
                      reasons: "",
                      jokes: "",
                      gallery: "",
                      ...section.headingLabels,
                      [key]: e.target.value,
                    },
                  })
                }
              />
            </Field>
          ))}
        </>
      ) : null}
    </details>
  );
}
const sceneNames: Record<string, string> = {
  title: "Opening / chapter title",
  lines: "Text appearing line by line",
  letter: "Animated envelope and letter",
  map: "Journey map",
  clocks: "Two clocks",
  chat: "Conversation",
  count: "Animated counter",
  ticker: "Countdown",
  solo: "Full photograph",
  duo: "Two photographs",
  split: "Photograph and story",
  grid: "Photo grid",
  scatter: "Scattered memories",
  mosaic: "Photo mosaic",
  strip: "Filmstrip",
  stack: "Stack of prints",
  video: "Video",
  booth: "Photobooth strip",
  goodbye: "Departure / flight",
  vows: "Promises and signature",
};
export function ItemSettings({
  item,
  normal = false,
  type,
  files,
  onChange,
}: {
  item: GiftItem;
  normal?: boolean;
  type: GiftSection["type"];
  files: Media[];
  onChange: (change: Partial<GiftItem>) => void;
}) {
  const details = item.details || [];
  return (
    <div className="original-settings">
      {type==='cosmos'?<><Field label="Planet colour"><input type="color" value={item.planetColor||'#7c9cff'} onChange={e=>onChange({planetColor:e.target.value})}/></Field><Field label="Planet radius"><input type="number" min={.2} max={3} step={.05} value={item.planetRadius??.6} onChange={e=>onChange({planetRadius:Number(e.target.value)})}/></Field><p className="small muted">Structured details below become moons: label is the moon name, value is its story.</p></>:null}
      {type === "film" ? (
        <Field label="Scene composition">
          <select
            value={normal && item.sceneType === "letter" ? "lines" : item.sceneType || ""}
            onChange={(e) =>
              onChange({
                sceneType: e.target.value
                  ? (e.target.value as GiftItem["sceneType"])
                  : undefined,
              })
            }
          >
            <option value="">Automatic from media</option>
            {sceneTypes.filter(s => !normal || s !== "letter").map((s) => (
              <option key={s} value={s}>
                {sceneNames[s]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {type==='film'?<Field label="Words to emphasise in gold"><input value={item.emphasis||''} maxLength={160} onChange={e=>onChange({emphasis:e.target.value})}/></Field>:null}
      <Field label="Chapter / small heading">
        <input
          value={item.chapter || ""}
          maxLength={160}
          onChange={(e) => onChange({ chapter: e.target.value })}
        />
      </Field>
      <Field label="Subtitle / caption">
        <textarea
          value={item.subtitle || ""}
          maxLength={2000}
          rows={2}
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </Field>
      <Field label="Author / signature">
        <input
          value={item.author || ""}
          maxLength={80}
          onChange={(e) => onChange({ author: e.target.value })}
        />
      </Field>
      <Field label="Location / envelope stamp">
        <input
          value={item.location || ""}
          maxLength={160}
          onChange={(e) => onChange({ location: e.target.value })}
        />
      </Field>
      <Field
        label={
          type === "surprise" ? "Words displayed above the seal" : "Quotation"
        }
      >
        <textarea
          value={item.quote || ""}
          maxLength={4000}
          rows={3}
          onChange={(e) => onChange({ quote: e.target.value })}
        />
      </Field>
      {type === "film" ? (
        <>
          <Field label="Scene date">
            <input
              type="date"
              value={item.date}
              onChange={(e) => onChange({ date: e.target.value })}
            />
          </Field>
          {item.sceneType === "count" ? (
            <Field label="Counter target">
              <input
                type="number"
                min={0}
                max={1000000000}
                value={item.counter ?? 0}
                onChange={(e) => onChange({ counter: Number(e.target.value) })}
              />
            </Field>
          ) : null}
          {item.sceneType === "map" ? (
            <>
              {(["mapFrom", "mapTo"] as const).map((key, i) => (
                <div className="form-row" key={key}>
                  <Field label={`${i ? "To" : "From"} latitude`}>
                    <input
                      type="number"
                      step="0.01"
                      min={-90}
                      max={90}
                      value={item[key]?.[0] ?? (i ? 48.8566 : 51.5074)}
                      onChange={(e) =>
                        onChange({
                          [key]: [
                            Number(e.target.value),
                            item[key]?.[1] ?? (i ? 2.3522 : -0.1278),
                          ],
                        })
                      }
                    />
                  </Field>
                  <Field label={`${i ? "To" : "From"} longitude`}>
                    <input
                      type="number"
                      step="0.01"
                      min={-180}
                      max={180}
                      value={item[key]?.[1] ?? (i ? 2.3522 : -0.1278)}
                      onChange={(e) =>
                        onChange({
                          [key]: [
                            item[key]?.[0] ?? (i ? 48.8566 : 51.5074),
                            Number(e.target.value),
                          ],
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
            </>
          ) : null}
        </>
      ) : null}
      <details>
        <summary>Additional photos and structured details</summary>
        <p className="small muted">
          Add any number of photos up to your package limit. Order determines
          the montage. For conversations, labels are times and values are
          messages. For clocks use HH:MM. For countdowns labels are
          milliseconds.
        </p>
        {(item.extraMediaIds || []).map((id, i) => (
          <div className="extra-media-row" key={`${id}-${i}`}>
            <MediaSelect
              label={`Additional photo ${i + 1}`}
              value={id}
              files={files}
              onChange={(value) =>
                onChange({
                  extraMediaIds: (item.extraMediaIds || []).map((old, n) =>
                    n === i ? value || old : old,
                  ),
                })
              }
            />
            <button type="button" className="text-link" disabled={i === 0} aria-label={`Move photo ${i + 1} up`} onClick={() => {const ids=[...(item.extraMediaIds||[])];[ids[i-1],ids[i]]=[ids[i],ids[i-1]];onChange({extraMediaIds:ids});}}>↑</button>
            <button type="button" className="text-link" disabled={i === (item.extraMediaIds?.length||0)-1} aria-label={`Move photo ${i + 1} down`} onClick={() => {const ids=[...(item.extraMediaIds||[])];[ids[i],ids[i+1]]=[ids[i+1],ids[i]];onChange({extraMediaIds:ids});}}>↓</button>
            <button
              className="text-link danger"
              onClick={() =>
                onChange({
                  extraMediaIds: item.extraMediaIds?.filter((_, n) => n !== i),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="text-link"
          disabled={
            !files.some((f) => f.mime.startsWith("image/")) ||
            (item.extraMediaIds?.length || 0) >= 100
          }
          onClick={() =>
            onChange({
              extraMediaIds: [
                ...(item.extraMediaIds || []),
                files.find((f) => f.mime.startsWith("image/"))!.id,
              ],
            })
          }
        >
          Add a photo
        </button>
        {details.map((detail, i) => (
          <div className="detail-row" key={i}>
            <Field label={`Label ${i + 1}`}>
              <input
                value={detail.label}
                maxLength={160}
                onChange={(e) =>
                  onChange({
                    details: details.map((d, n) =>
                      n === i ? { ...d, label: e.target.value } : d,
                    ),
                  })
                }
              />
            </Field>
            <Field label={`Value ${i + 1}`}>
              <textarea
                value={detail.value}
                rows={3}
                maxLength={12000}
                onChange={(e) =>
                  onChange({
                    details: details.map((d, n) =>
                      n === i ? { ...d, value: e.target.value } : d,
                    ),
                  })
                }
              />
            </Field>
            <div className="detail-actions">
              <button
                className="text-link"
                disabled={!i}
                onClick={() => {
                  const rows = [...details];
                  [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
                  onChange({ details: rows });
                }}
              >
                Move up
              </button>
              <button
                className="text-link danger"
                onClick={() =>
                  onChange({ details: details.filter((_, n) => n !== i) })
                }
              >
                Remove row
              </button>
            </div>
          </div>
        ))}
        <button
          className="text-link"
          disabled={details.length >= 100}
          onClick={() =>
            onChange({ details: [...details, { label: "", value: "" }] })
          }
        >
          Add a detail / message
        </button>
      </details>
    </div>
  );
}
