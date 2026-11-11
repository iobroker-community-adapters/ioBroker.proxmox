import{jsx as e,jsxs as t,createRoot as n}from"../../../lib/esm/react-19.js";var r=`iob-dialog-close`;function i(e){return!!e.form}var a=[`header`,`staticText`,`divider`];function o(e,t){return e==null?``:typeof e==`object`?e[t]||e.en||Object.values(e).find(e=>!!e)||``:String(e)}function s(e){let t={};for(let[n,r]of Object.entries(e.items||{}))r&&!a.includes(r.type)&&(t[n]=r.type);return t}function c(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?e.toString():JSON.stringify(e)}function l(e,t){if(t!=null)switch(e){case`number`:case`slider`:{if(typeof t==`number`)return Number.isFinite(t)?t:void 0;let e=c(t).trim().replace(`,`,`.`);if(!e)return;let n=Number(e);return Number.isFinite(n)?n:void 0}case`checkbox`:return t===!0||t===`true`||t===1||t===`1`;default:return c(t)}}function u(e,t){let n={};for(let[r,i]of Object.entries(e)){let e=l(i,t[r]);e!==void 0&&(n[r]=e)}return n}var d=`"Roboto", "Helvetica", "Arial", sans-serif`,f=Object.freeze({type:`light`,primary:`#3399CC`,primaryContrast:`#FFFFFF`,secondary:`#164477`,secondaryContrast:`#FFFFFF`,background:`#FFFFFF`,paper:`#FFFFFF`,text:`rgba(0, 0, 0, 0.87)`,textSecondary:`rgba(0, 0, 0, 0.6)`,divider:`rgba(0, 0, 0, 0.12)`,error:`#D32F2F`,warning:`#ED6C02`,info:`#0288D1`,success:`#2E7D32`,fontFamily:d,fontSize:14,borderRadius:4}),p=Object.freeze({type:`dark`,primary:`#4DABF5`,primaryContrast:`rgba(0, 0, 0, 0.87)`,secondary:`#436A93`,secondaryContrast:`#FFFFFF`,background:`#121212`,paper:`#121212`,text:`#FFFFFF`,textSecondary:`rgba(255, 255, 255, 0.7)`,divider:`rgba(255, 255, 255, 0.12)`,error:`#F44336`,warning:`#FFA726`,info:`#29B6F6`,success:`#66BB6A`,fontFamily:d,fontSize:14,borderRadius:4}),m=[`primary`,`primaryContrast`,`secondary`,`secondaryContrast`,`background`,`paper`,`text`,`textSecondary`,`divider`,`error`,`warning`,`info`,`success`,`fontFamily`],h=[`fontSize`,`borderRadius`];function g(e){return{...e===`dark`?p:f}}function _(e){if(!e||typeof e!=`object`)return g(typeof e==`string`?e:`light`);let t=e,n=g(typeof t.type==`string`?t.type:`light`);for(let e of m){let r=t[e];typeof r==`string`&&r.trim()&&(n[e]=r.trim())}for(let e of h){let r=t[e],i=typeof r==`string`?parseFloat(r):r;typeof i==`number`&&Number.isFinite(i)&&i>=0&&(n[e]=i)}return n}function v(e,t){return e.type===t.type&&m.every(n=>e[n]===t[n])&&h.every(n=>e[n]===t[n])}function y(e){return`--iob-${e.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`)}`}function b(e){let t={};for(let n of m)t[y(n)]=e[n];for(let n of h)t[y(n)]=`${e[n]}px`;return t[`color-scheme`]=e.type,t}var x={ok:{en:`OK`,"zh-cn":`确定`},cancel:{en:`Cancel`,de:`Abbrechen`,ru:`Отмена`,pt:`Cancelar`,nl:`Annuleren`,fr:`Annuler`,it:`Annulla`,es:`Cancelar`,pl:`Anuluj`,uk:`Скасувати`,"zh-cn":`取消`},close:{en:`Close`,de:`Schließen`,ru:`Закрыть`,pt:`Fechar`,nl:`Sluiten`,fr:`Fermer`,it:`Chiudi`,es:`Cerrar`,pl:`Zamknij`,uk:`Закрити`,"zh-cn":`关闭`}},S=`
dialog {
    box-sizing: border-box;
    width: 480px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    padding: 0;
    border: 0;
    border-radius: calc(var(--iob-border-radius) * 2);
    background: var(--iob-paper);
    color: var(--iob-text);
    font-family: var(--iob-font-family);
    font-size: var(--iob-font-size);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
/* as the dialogs of MUI: a dark paper gets lighter the higher it lies */
dialog.dark { background-image: linear-gradient(rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.16)); }
dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
dialog:focus { outline: none; }
form { display: flex; flex-direction: column; height: 100%; max-height: inherit; margin: 0; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px; font-size: 1.15em; font-weight: 500; }
header span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body { flex: 1; min-height: 0; padding: 0 16px 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }
button { font: inherit; padding: 6px 16px; border-radius: var(--iob-border-radius); border: 1px solid var(--iob-primary); background: transparent; color: var(--iob-primary); cursor: pointer; }
button.primary { background: var(--iob-primary); color: var(--iob-primary-contrast); }
button.close { border: 0; padding: 2px 8px; font-size: 1.4em; line-height: 1; color: var(--iob-text-secondary); }
label { display: flex; flex-direction: column; gap: 4px; }
label.check { flex-direction: row; align-items: center; gap: 8px; }
input, select, textarea { font: inherit; accent-color: var(--iob-primary); }
.help { color: var(--iob-text-secondary); font-size: 0.85em; }
h3 { margin: 4px 0 0; font-size: 1em; }
p { margin: 0; }
hr { width: 100%; border: 0; border-top: 1px solid var(--iob-divider); margin: 0; }
[hidden] { display: none !important; }
`;function C(e){if(!e)return null;try{let t=Function(`data`,`return (${e});`);return e=>{try{return!!t(e)}catch{return!1}}}catch{return null}}function w(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?String(e):``}function ee(e){let{input:t,setting:n}=e;if(t)return t instanceof HTMLInputElement&&t.type===`checkbox`?t.checked:t instanceof HTMLSelectElement?n.options?.[t.selectedIndex]?.value:t.value}function T(e,t,n,r,i){let a={name:t,setting:n,box:e.createElement(`div`),hidden:C(n.hidden),disabled:C(n.disabled)},s=o(n.label,i);switch(n.type){case`header`:return a.box=e.createElement(`h3`),a.box.textContent=o(n.text,i)||s,a;case`staticText`:return a.box=e.createElement(`p`),a.box.textContent=o(n.text,i)||s,a;case`divider`:return a.box=e.createElement(`hr`),a}let c=e.createElement(`label`);a.box=c;let l=e.createElement(`span`);if(l.textContent=s||t,n.type===`checkbox`){let t=e.createElement(`input`);t.type=`checkbox`,t.checked=r===!0||r===`true`,c.className=`check`,c.append(t,l),a.input=t}else if(n.type===`select`){let t=e.createElement(`select`);for(let r of n.options||[]){let n=e.createElement(`option`);n.textContent=o(r.label,i),t.append(n)}let s=(n.options||[]).findIndex(e=>String(e.value)===w(r));t.selectedIndex=s===-1?0:s,c.append(l,t),a.input=t}else if(n.type===`text`&&(n.minRows||1)>1){let t=e.createElement(`textarea`);t.rows=n.minRows||2,t.value=w(r),c.append(l,t),a.input=t}else{let t=e.createElement(`input`),i=w(r);switch(n.type){case`number`:case`slider`:t.type=n.type===`slider`?`range`:`number`,n.min!==void 0&&(t.min=String(n.min)),n.max!==void 0&&(t.max=String(n.max)),t.step=n.step===void 0?`any`:String(n.step);break;case`password`:t.type=`password`;break;case`color`:t.type=!i||/^#[0-9a-f]{6}$/i.test(i)?`color`:`text`;break;default:t.type=`text`}if(t.value=i,t.type===`range`){let n=e.createElement(`output`);n.textContent=t.value,t.addEventListener(`input`,()=>n.textContent=t.value),l.append(`: `,n)}c.append(l,t),a.input=t}if(n.help){let t=e.createElement(`span`);t.className=`help`,t.textContent=o(n.help,i),c.append(t)}return a}function E(e,t={}){let n=t.lang||`en`,a=document,c=e=>x[e][n]||x[e].en||e,l=a.createElement(`div`);l.setAttribute(`data-iob-dialog`,``);let d=l.attachShadow({mode:`open`}),f=a.createElement(`style`);f.textContent=S;let p=a.createElement(`dialog`),m=_(t.theme);p.className=m.type===`dark`?`dark`:``;for(let[e,t]of Object.entries(b(m)))p.style.setProperty(e,t);e.width&&(p.style.width=`${e.width}px`),e.height&&(p.style.height=`${e.height}px`);let h=a.createElement(`form`),g=a.createElement(`header`),v=a.createElement(`span`);v.textContent=o(e.title,n);let y=a.createElement(`button`);y.type=`button`,y.className=`close`,y.title=c(`close`),y.setAttribute(`aria-label`,c(`close`)),y.textContent=`×`,g.append(v,y);let C=a.createElement(`div`);return C.className=`body`,h.append(g,C),p.append(h),d.append(f,p),new Promise(t=>{let f=!1,m=e=>{f||(f=!0,p.open&&p.close(),l.remove(),t(e))};if(y.addEventListener(`click`,()=>m(null)),p.addEventListener(`close`,()=>m(null)),h.addEventListener(`submit`,e=>e.preventDefault()),i(e)){let t={},r=[];for(let[t,i]of Object.entries(e.form.items||{})){let o=e.data?.[t]??i.default,s=T(a,t,i,o,n);r.push(s),C.append(s.box)}let i=()=>{for(let e of r)e.input&&(t[e.name]=ee(e));return t},l=()=>{let e=i();for(let t of r)t.box.hidden=t.hidden?t.hidden(e):!1,t.input&&(t.input.disabled=t.disabled?t.disabled(e):!1)};h.addEventListener(`input`,l),h.addEventListener(`change`,l),l();let d=r.find(e=>e.input&&!e.box.hidden&&!e.input.disabled);d?.input&&(d.input.autofocus=!0);let f=a.createElement(`footer`),p=a.createElement(`button`);p.type=`button`,p.textContent=o(e.cancel,n)||c(`cancel`),p.addEventListener(`click`,()=>m(null));let g=a.createElement(`button`);g.type=`submit`,g.className=`primary`,g.textContent=o(e.ok,n)||c(`ok`),f.append(p,g),h.append(f),h.addEventListener(`submit`,()=>m(u(s(e.form),i())))}else C.append(e.element),p.addEventListener(r,e=>m(e.detail??null));a.body.append(l),p.showModal(),d.activeElement&&d.activeElement!==y||(p.tabIndex=-1,p.focus())})}function D(e){return[...new Set(e.filter(e=>typeof e==`string`&&!!e))]}var O=[`socket`,`dialogs`,`theme`,`editMode`,`settings`,`value`],k=class extends HTMLElement{states={};objects={};#e=null;#t={};#n=_(`light`);#r=!1;#i=null;#a=void 0;#o=null;#s=!1;#c=(e,t)=>{this.#o?.states.includes(e)&&(this.states[e]=t||null,this.#_())};#l=(e,t)=>{this.#o?.objects.includes(e)&&(this.objects[e]=t||null,this.#d())};get socket(){return this.#e}set socket(e){this.#e=e||null,this.#d()}get settings(){return this.#t}set settings(e){this.#t=e||{},this.#d()}get theme(){return this.#n}set theme(e){let t=_(e);v(t,this.#n)||(this.#n=t,this.#u(),this.#_())}get editMode(){return this.#r}set editMode(e){let t=!!e;t!==this.#r&&(this.#r=t,this.#_())}get dialogs(){return this.#i}set dialogs(e){this.#i=e||null}get value(){return this.#a}set value(e){e!==this.#a&&(this.#a=e,this.#_())}connectedCallback(){for(let e of O)if(Object.prototype.hasOwnProperty.call(this,e)){let t=this[e];delete this[e],this[e]=t}this.#u(),this.#d()}disconnectedCallback(){this.#g()}getStateIds(e){return[]}getObjectIds(e){return[]}get systemLang(){return this.#e?.systemLang||`en`}text(e){return o(e,this.systemLang)}setState(e,t){return this.#e&&!this.#r?this.#e.setState(e,t):Promise.resolve()}changeValue(e){return this.#r||this.emit(`iob-change`,e)?!1:(this.value=e,!0)}emit(e,t){return this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0,cancelable:!0}))}async openDialog(e){if(this.#r)return null;let t=this.#i?await this.#i.open(e):await E(e,{lang:this.systemLang,theme:this.#n});return i(e)?t&&typeof t==`object`?u(s(e.form),t):null:t??null}#u(){for(let[e,t]of Object.entries(b(this.#n)))this.style.setProperty(e,t)}#d(){if(!this.isConnected)return;let e=this.#e,t=e?D(this.getStateIds(this.#t)):[],n=e?D(this.getObjectIds(this.#t)):[];this.#o&&this.#o.socket!==e&&this.#g();let r=this.#o?.states||[],i=this.#o?.objects||[],a=r.filter(e=>!t.includes(e)),o=i.filter(e=>!n.includes(e)),s=t.filter(e=>!r.includes(e)),c=n.filter(e=>!i.includes(e));e&&a.length&&e.unsubscribeState(a,this.#c),e&&o.length&&this.#h(e,o);for(let e of a)delete this.states[e];for(let e of[...a,...o])!t.includes(e)&&!n.includes(e)&&delete this.objects[e];this.#o=e&&(t.length||n.length)?{socket:e,states:t,objects:n}:null,e&&s.length&&this.#p(e,s),e&&c.length&&this.#m(e,c),this.#_()}#f(e,t,n){return this.#o?.socket===e&&this.#o[t].includes(n)}#p(e,t){e.subscribeState(t,this.#c).catch(e=>console.warn(`<${this.localName}>: cannot subscribe ${t.join(`, `)}: ${e}`));for(let n of t)e.getState(n).then(t=>{this.#f(e,`states`,n)&&this.states[n]===void 0&&(this.states[n]=t||null,this.#_())}).catch(()=>{}),e.getObject(n).then(t=>{this.#f(e,`states`,n)&&!this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#_())}).catch(()=>{})}#m(e,t){e.subscribeObject(t,this.#l).catch(e=>console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(`, `)}: ${e}`));for(let n of t)e.getObject(n).then(t=>{this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#d())}).catch(()=>{})}#h(e,t){e.unsubscribeObject(t,this.#l).catch(()=>{})}#g(){if(this.#o){let{socket:e,states:t,objects:n}=this.#o;t.length&&e.unsubscribeState(t,this.#c),n.length&&this.#h(e,n),this.#o=null}this.states={},this.objects={}}#_(){this.#s||(this.#s=!0,queueMicrotask(()=>{this.#s=!1,this.isConnected&&this.render()}))}};function A(e,t){let n=typeof e==`string`?e:e.tag;customElements.get(n)||customElements.define(n,t)}var j=[`node`],M=[`status`,`cpu`,`cpu_max`,`memory.used`,`memory.total`,`memory.used_lev`,`uptime`,`updates.count`,`updates.list`,`updates.refresh`],N=`updates.refresh`,P=15e4,F=[`online`,`offline`];function I(e){switch(e){case`running`:case`online`:return`success`;case`paused`:case`suspended`:return`warning`;case`offline`:return`error`;case`stopped`:return`neutral`;default:return`unknown`}}function L(e){if(typeof e!=`number`||e<=0)return``;let t=Math.floor(e/86400),n=Math.floor(e%86400/3600),r=Math.floor(e%3600/60);return t?`${t} d ${n} h`:n?`${n} h ${r} min`:r?`${r} min`:`< 1 min`}var R=1024;function z(e){return e<R?`${e} MiB`:`${Math.round(e/R*10)/10} GiB`}function B(e,t,n){return typeof e==`number`&&typeof t==`number`&&t>0?`${z(e)} / ${z(t)}`:typeof n==`number`?`${n} %`:`–`}function V(e){return!e||e<=0?`unknown`:e>90?`error`:e>75?`warning`:`success`}function H(e){switch(e){case`lxc`:return`LXC`;case`qemu`:return`QEMU`;case`node`:return`Proxmox VE`;default:return``}}function U(e){if(typeof e!=`string`)return[];try{let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}}function W(e){return e.version?`${e.package||``} ${e.oldVersion?`${e.oldVersion} → `:``}${e.version}`:e.package||``}function G(e){let t=e?.native?.type;return e?.type===`channel`&&typeof t==`string`?t:``}var K={qemu:[`M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2zM4 6h16v10H4z`],lxc:[`m18.25 7.6-5.5-3.18c-.46-.27-1.04-.27-1.5 0L5.75 7.6c-.46.27-.75.76-.75 1.3v6.35c0 .54.29 1.03.75 1.3l5.5 3.18c.46.27 1.04.27 1.5 0l5.5-3.18c.46-.27.75-.76.75-1.3V8.9c0-.54-.29-1.03-.75-1.3M7 14.96v-4.62l4 2.32v4.61zm5-4.03L8 8.61l4-2.31 4 2.31zm1 6.34v-4.61l4-2.32v4.62zM7 2H3.5C2.67 2 2 2.67 2 3.5V7h2V4h3zm10 0h3.5c.83 0 1.5.67 1.5 1.5V7h-2V4h-3zM7 22H3.5c-.83 0-1.5-.67-1.5-1.5V17h2v3h3zm10 0h3.5c.83 0 1.5-.67 1.5-1.5V17h-2v3h-3z`],node:[`M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1M7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1M7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2`],start:[`M8 5v14l11-7z`],stop:[`M6 6h12v12H6z`],refresh:[`M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z`],uptime:[`M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8`,`M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z`],update:[`m12 16.5 4-4h-3v-9h-2v9H8zm9-13h-6v1.99h6v14.03H3V5.49h6V3.5H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-14c0-1.1-.9-2-2-2`],upToDate:[`M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z`]};function q(e){return e===`node`?`node`:e===`lxc`?`lxc`:`qemu`}var J=`iob-proxmox-node`;function Y({name:t}){return/* @__PURE__ */ e(`svg`,{viewBox:`0 0 24 24`,fill:`currentColor`,"aria-hidden":`true`,children:K[t].map(t=>/* @__PURE__ */ e(`path`,{d:t},t))})}function X(n){let{type:r,kind:i,name:a,typeName:o,uptime:s,uptimeLabel:c,status:l}=n;return/* @__PURE__ */ t(`div`,{className:`head`,children:[/* @__PURE__ */ e(`div`,{className:`avatar ${i}`,children:/* @__PURE__ */ e(Y,{name:q(r)})}),/* @__PURE__ */ t(`div`,{className:`titles`,children:[/* @__PURE__ */ e(`div`,{className:`name`,title:a,children:a}),o||s?/* @__PURE__ */ t(`div`,{className:`meta`,children:[o?/* @__PURE__ */ e(`span`,{children:o}):null,s?/* @__PURE__ */ t(`span`,{title:c,children:[/* @__PURE__ */ e(Y,{name:`uptime`}),s]}):null]}):null]}),l]})}function Z({kind:n,label:r,icon:i,title:a}){return/* @__PURE__ */ t(`span`,{className:`pill ${n}`,title:a,children:[i?/* @__PURE__ */ e(Y,{name:i}):null,r]})}function Q({label:n,percent:r,text:i}){return/* @__PURE__ */ t(`div`,{className:`bar ${V(r)}`,children:[/* @__PURE__ */ t(`div`,{className:`labels`,children:[/* @__PURE__ */ e(`span`,{children:n}),/* @__PURE__ */ e(`span`,{title:i,children:i})]}),/* @__PURE__ */ e(`div`,{className:`track`,children:/* @__PURE__ */ e(`div`,{className:`fill`,style:{width:`${Math.min(Math.max(r??0,0),100)}%`}})})]})}function te(n){let{className:r,icon:i,label:a,title:o,disabled:s,onClick:c}=n;return/* @__PURE__ */ t(`button`,{type:`button`,className:r,title:o||a,"aria-label":o||a,disabled:s,onClick:c,children:[/* @__PURE__ */ e(Y,{name:i}),/* @__PURE__ */ e(`span`,{className:`word`,children:a})]})}function ne({text:n,editMode:r}){return/* @__PURE__ */ t(`div`,{className:r?`hint edit`:`hint`,children:[/* @__PURE__ */ e(`svg`,{viewBox:`0 0 24 24`,"aria-hidden":`true`,children:/* @__PURE__ */ e(`path`,{d:`M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8`})}),/* @__PURE__ */ e(`span`,{children:n})]})}var $={en:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM or container`,proxmox_machine:`VM or container`,proxmox_machine_help:`The VM or container this widget shows`,proxmox_title:`Title`,proxmox_title_help:`If empty, the name of the machine is shown`,proxmox_show_controls:`Show controls`,proxmox_show_controls_help:`If disabled, the widget only displays the state`,proxmox_uptime:`Uptime`,proxmox_show_uptime:`Show uptime`,proxmox_show_icon:`Show icon`,proxmox_icon:`Icon`,proxmox_icon_help:`If empty, the symbol of the type is shown`,proxmox_image:`Image`,proxmox_image_help:`An image file, used instead of the icon`,proxmox_show_details:`Show CPU and RAM`,proxmox_stop_command:`Stop button`,proxmox_stop_shutdown:`Shut down cleanly`,proxmox_stop_hard:`Power off immediately`,proxmox_ask_confirmation:`Ask before stopping`,proxmox_no_card:`Without card`,proxmox_no_machine:`Select a VM or container`,proxmox_start:`Start`,proxmox_stop:`Stop`,proxmox_cancel:`Cancel`,proxmox_in_progress:`In progress…`,proxmox_unknown:`Unknown`,proxmox_status_running:`Running`,proxmox_status_stopped:`Stopped`,proxmox_status_paused:`Paused`,proxmox_status_suspended:`Suspended`,proxmox_status_offline:`Offline`,proxmox_confirm_shutdown:`Really shut down "%s"?`,proxmox_confirm_hard:`Really power off "%s" immediately, without a clean shutdown? Unsaved data can be lost.`,proxmox_command_failed:`The command could not be sent`,proxmox_node_widget_label:`Proxmox node`,proxmox_node:`Node`,proxmox_node_help:`The Proxmox node this widget shows`,proxmox_node_title_help:`If empty, the name of the node is shown`,proxmox_no_node:`Select a node`,proxmox_updates:`Available updates`,proxmox_updates_help:`Needs the option "Request available updates" in the adapter`,proxmox_updates_control:`Show and refresh`,proxmox_updates_show:`Show only`,proxmox_updates_hidden:`Do not show`,proxmox_status_online:`Online`,proxmox_update_available:`1 update`,proxmox_updates_available:`%s updates`,proxmox_up_to_date:`Up to date`,proxmox_refresh:`Refresh`,proxmox_refresh_help:`Refreshes the package index of the node (apt update)`,proxmox_refreshing:`Refreshing…`,proxmox_more_updates:`… and %s more`,proxmox_updates_off:`Available updates are not enabled in the adapter`,proxmox_machine_id_help:`The channel of the VM or container, for example proxmox.0.lxc_web`,proxmox_node_id_help:`The channel of the node, for example proxmox.0.node_pve`,proxmox_not_machine:`This is not a VM or container of the Proxmox adapter`,proxmox_not_node:`This is not a node of the Proxmox adapter`,proxmox_instance:`Instance`},de:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM oder Container`,proxmox_machine:`VM oder Container`,proxmox_machine_help:`Die VM oder der Container, den dieses Widget anzeigt`,proxmox_title:`Titel`,proxmox_title_help:`Ist er leer, wird der Name der Maschine angezeigt`,proxmox_show_controls:`Steuerung anzeigen`,proxmox_show_controls_help:`Ist das deaktiviert, zeigt das Widget nur den Zustand an`,proxmox_uptime:`Laufzeit`,proxmox_show_uptime:`Laufzeit anzeigen`,proxmox_show_icon:`Symbol anzeigen`,proxmox_icon:`Icon`,proxmox_icon_help:`Ist es leer, wird das Symbol des Typs angezeigt`,proxmox_image:`Bild`,proxmox_image_help:`Eine Bilddatei, sie wird statt des Icons angezeigt`,proxmox_show_details:`CPU und RAM anzeigen`,proxmox_stop_command:`Stopp-Taste`,proxmox_stop_shutdown:`Sauber herunterfahren`,proxmox_stop_hard:`Sofort ausschalten`,proxmox_ask_confirmation:`Vor dem Stoppen nachfragen`,proxmox_no_card:`Ohne Karte`,proxmox_no_machine:`VM oder Container auswählen`,proxmox_start:`Starten`,proxmox_stop:`Stoppen`,proxmox_cancel:`Abbrechen`,proxmox_in_progress:`Wird ausgeführt …`,proxmox_unknown:`Unbekannt`,proxmox_status_running:`Läuft`,proxmox_status_stopped:`Gestoppt`,proxmox_status_paused:`Pausiert`,proxmox_status_suspended:`Angehalten`,proxmox_status_offline:`Offline`,proxmox_confirm_shutdown:`„%s“ wirklich herunterfahren?`,proxmox_confirm_hard:`„%s“ wirklich sofort ausschalten, ohne sauberes Herunterfahren? Nicht gespeicherte Daten können verloren gehen.`,proxmox_command_failed:`Der Befehl konnte nicht gesendet werden`,proxmox_node_widget_label:`Proxmox-Node`,proxmox_node:`Node`,proxmox_node_help:`Der Proxmox-Node, den dieses Widget anzeigt`,proxmox_node_title_help:`Ist er leer, wird der Name des Nodes angezeigt`,proxmox_no_node:`Node auswählen`,proxmox_updates:`Verfügbare Updates`,proxmox_updates_help:`Benötigt im Adapter die Option „Verfügbare Updates abfragen“`,proxmox_updates_control:`Anzeigen und aktualisieren`,proxmox_updates_show:`Nur anzeigen`,proxmox_updates_hidden:`Nicht anzeigen`,proxmox_status_online:`Online`,proxmox_update_available:`1 Update`,proxmox_updates_available:`%s Updates`,proxmox_up_to_date:`Aktuell`,proxmox_refresh:`Aktualisieren`,proxmox_refresh_help:`Aktualisiert die Paketliste des Nodes (apt update)`,proxmox_refreshing:`Wird aktualisiert …`,proxmox_more_updates:`… und %s weitere`,proxmox_updates_off:`Verfügbare Updates sind im Adapter nicht aktiviert`,proxmox_machine_id_help:`Der Kanal der VM oder des Containers, zum Beispiel proxmox.0.lxc_web`,proxmox_node_id_help:`Der Kanal des Nodes, zum Beispiel proxmox.0.node_pve`,proxmox_not_machine:`Das ist keine VM und kein Container des Proxmox-Adapters`,proxmox_not_node:`Das ist kein Node des Proxmox-Adapters`,proxmox_instance:`Instanz`},ru:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`ВМ или контейнер`,proxmox_machine:`ВМ или контейнер`,proxmox_machine_help:`ВМ или контейнер, которые показывает этот виджет`,proxmox_title:`Заголовок`,proxmox_title_help:`Если пусто, показывается имя машины`,proxmox_show_controls:`Показать управление`,proxmox_show_controls_help:`Если отключено, виджет только показывает состояние`,proxmox_uptime:`Время работы`,proxmox_show_uptime:`Показывать время работы`,proxmox_show_icon:`Показывать значок`,proxmox_icon:`Значок`,proxmox_icon_help:`Если пусто, показывается значок типа`,proxmox_image:`Изображение`,proxmox_image_help:`Файл изображения, показывается вместо значка`,proxmox_show_details:`Показать CPU и RAM`,proxmox_stop_command:`Кнопка остановки`,proxmox_stop_shutdown:`Корректно завершить работу`,proxmox_stop_hard:`Немедленно отключить`,proxmox_ask_confirmation:`Спрашивать перед остановкой`,proxmox_no_card:`Без карточки`,proxmox_no_machine:`Выберите ВМ или контейнер`,proxmox_start:`Запустить`,proxmox_stop:`Остановить`,proxmox_cancel:`Отмена`,proxmox_in_progress:`Выполняется…`,proxmox_unknown:`Неизвестно`,proxmox_status_running:`Работает`,proxmox_status_stopped:`Остановлена`,proxmox_status_paused:`На паузе`,proxmox_status_suspended:`Приостановлена`,proxmox_status_offline:`Не в сети`,proxmox_confirm_shutdown:`Действительно выключить «%s»?`,proxmox_confirm_hard:`Действительно немедленно отключить «%s» без корректного завершения работы? Несохранённые данные могут быть потеряны.`,proxmox_command_failed:`Не удалось отправить команду`,proxmox_node_widget_label:`Узел Proxmox`,proxmox_node:`Узел`,proxmox_node_help:`Узел Proxmox, который показывает этот виджет`,proxmox_node_title_help:`Если пусто, показывается имя узла`,proxmox_no_node:`Выберите узел`,proxmox_updates:`Доступные обновления`,proxmox_updates_help:`Требуется опция «Запрашивать доступные обновления» в адаптере`,proxmox_updates_control:`Показывать и обновлять`,proxmox_updates_show:`Только показывать`,proxmox_updates_hidden:`Не показывать`,proxmox_status_online:`В сети`,proxmox_update_available:`1 обновление`,proxmox_updates_available:`Обновлений: %s`,proxmox_up_to_date:`Актуально`,proxmox_refresh:`Обновить`,proxmox_refresh_help:`Обновляет список пакетов узла (apt update)`,proxmox_refreshing:`Обновление…`,proxmox_more_updates:`… и ещё %s`,proxmox_updates_off:`Доступные обновления не включены в адаптере`,proxmox_machine_id_help:`Канал ВМ или контейнера, например proxmox.0.lxc_web`,proxmox_node_id_help:`Канал узла, например proxmox.0.node_pve`,proxmox_not_machine:`Это не ВМ и не контейнер адаптера Proxmox`,proxmox_not_node:`Это не узел адаптера Proxmox`,proxmox_instance:`Экземпляр`},pt:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM ou contentor`,proxmox_machine:`VM ou contentor`,proxmox_machine_help:`A VM ou o contentor que este widget mostra`,proxmox_title:`Título`,proxmox_title_help:`Se estiver vazio, é mostrado o nome da máquina`,proxmox_show_controls:`Mostrar controlos`,proxmox_show_controls_help:`Se desativado, o widget apenas mostra o estado`,proxmox_uptime:`Tempo de atividade`,proxmox_show_uptime:`Mostrar tempo de atividade`,proxmox_show_icon:`Mostrar ícone`,proxmox_icon:`Ícone`,proxmox_icon_help:`Se estiver vazio, é mostrado o símbolo do tipo`,proxmox_image:`Imagem`,proxmox_image_help:`Um ficheiro de imagem, usado em vez do ícone`,proxmox_show_details:`Mostrar CPU e RAM`,proxmox_stop_command:`Botão de parar`,proxmox_stop_shutdown:`Encerrar corretamente`,proxmox_stop_hard:`Desligar de imediato`,proxmox_ask_confirmation:`Perguntar antes de parar`,proxmox_no_card:`Sem cartão`,proxmox_no_machine:`Selecione uma VM ou um contentor`,proxmox_start:`Iniciar`,proxmox_stop:`Parar`,proxmox_cancel:`Cancelar`,proxmox_in_progress:`Em curso…`,proxmox_unknown:`Desconhecido`,proxmox_status_running:`Em execução`,proxmox_status_stopped:`Parada`,proxmox_status_paused:`Em pausa`,proxmox_status_suspended:`Suspensa`,proxmox_status_offline:`Offline`,proxmox_confirm_shutdown:`Encerrar mesmo "%s"?`,proxmox_confirm_hard:`Desligar mesmo "%s" de imediato, sem um encerramento correto? Os dados não guardados podem ser perdidos.`,proxmox_command_failed:`Não foi possível enviar o comando`,proxmox_node_widget_label:`Nó Proxmox`,proxmox_node:`Nó`,proxmox_node_help:`O nó Proxmox que este widget mostra`,proxmox_node_title_help:`Se vazio, é mostrado o nome do nó`,proxmox_no_node:`Selecione um nó`,proxmox_updates:`Atualizações disponíveis`,proxmox_updates_help:`Requer a opção "Solicitar atualizações disponíveis" no adaptador`,proxmox_updates_control:`Mostrar e atualizar`,proxmox_updates_show:`Apenas mostrar`,proxmox_updates_hidden:`Não mostrar`,proxmox_status_online:`Online`,proxmox_update_available:`1 atualização`,proxmox_updates_available:`%s atualizações`,proxmox_up_to_date:`Atualizado`,proxmox_refresh:`Atualizar`,proxmox_refresh_help:`Atualiza a lista de pacotes do nó (apt update)`,proxmox_refreshing:`A atualizar…`,proxmox_more_updates:`… e mais %s`,proxmox_updates_off:`As atualizações disponíveis não estão ativadas no adaptador`,proxmox_machine_id_help:`O canal da VM ou do contêiner, por exemplo proxmox.0.lxc_web`,proxmox_node_id_help:`O canal do nó, por exemplo proxmox.0.node_pve`,proxmox_not_machine:`Isto não é uma VM nem um contêiner do adaptador Proxmox`,proxmox_not_node:`Isto não é um nó do adaptador Proxmox`,proxmox_instance:`Instância`},nl:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM of container`,proxmox_machine:`VM of container`,proxmox_machine_help:`De VM of container die deze widget toont`,proxmox_title:`Titel`,proxmox_title_help:`Indien leeg wordt de naam van de machine getoond`,proxmox_show_controls:`Bediening tonen`,proxmox_show_controls_help:`Indien uitgeschakeld toont de widget alleen de status`,proxmox_uptime:`Uptime`,proxmox_show_uptime:`Uptime tonen`,proxmox_show_icon:`Pictogram tonen`,proxmox_icon:`Pictogram`,proxmox_icon_help:`Indien leeg, wordt het symbool van het type getoond`,proxmox_image:`Afbeelding`,proxmox_image_help:`Een afbeeldingsbestand, gebruikt in plaats van het pictogram`,proxmox_show_details:`CPU en RAM tonen`,proxmox_stop_command:`Stopknop`,proxmox_stop_shutdown:`Correct afsluiten`,proxmox_stop_hard:`Direct uitschakelen`,proxmox_ask_confirmation:`Vragen voor het stoppen`,proxmox_no_card:`Zonder kaart`,proxmox_no_machine:`Selecteer een VM of container`,proxmox_start:`Starten`,proxmox_stop:`Stoppen`,proxmox_cancel:`Annuleren`,proxmox_in_progress:`Bezig…`,proxmox_unknown:`Onbekend`,proxmox_status_running:`Actief`,proxmox_status_stopped:`Gestopt`,proxmox_status_paused:`Gepauzeerd`,proxmox_status_suspended:`Onderbroken`,proxmox_status_offline:`Offline`,proxmox_confirm_shutdown:`"%s" echt afsluiten?`,proxmox_confirm_hard:`"%s" echt direct uitschakelen, zonder correct af te sluiten? Niet-opgeslagen gegevens kunnen verloren gaan.`,proxmox_command_failed:`De opdracht kon niet worden verzonden`,proxmox_node_widget_label:`Proxmox-node`,proxmox_node:`Node`,proxmox_node_help:`De Proxmox-node die deze widget toont`,proxmox_node_title_help:`Indien leeg, wordt de naam van de node getoond`,proxmox_no_node:`Selecteer een node`,proxmox_updates:`Beschikbare updates`,proxmox_updates_help:`Vereist de optie "Beschikbare updates opvragen" in de adapter`,proxmox_updates_control:`Tonen en vernieuwen`,proxmox_updates_show:`Alleen tonen`,proxmox_updates_hidden:`Niet tonen`,proxmox_status_online:`Online`,proxmox_update_available:`1 update`,proxmox_updates_available:`%s updates`,proxmox_up_to_date:`Up-to-date`,proxmox_refresh:`Vernieuwen`,proxmox_refresh_help:`Vernieuwt de pakketlijst van de node (apt update)`,proxmox_refreshing:`Bezig met vernieuwen…`,proxmox_more_updates:`… en nog %s`,proxmox_updates_off:`Beschikbare updates zijn niet ingeschakeld in de adapter`,proxmox_machine_id_help:`Het kanaal van de VM of container, bijvoorbeeld proxmox.0.lxc_web`,proxmox_node_id_help:`Het kanaal van de node, bijvoorbeeld proxmox.0.node_pve`,proxmox_not_machine:`Dit is geen VM of container van de Proxmox-adapter`,proxmox_not_node:`Dit is geen node van de Proxmox-adapter`,proxmox_instance:`Instantie`},fr:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM ou conteneur`,proxmox_machine:`VM ou conteneur`,proxmox_machine_help:`La VM ou le conteneur affiché par ce widget`,proxmox_title:`Titre`,proxmox_title_help:`Si vide, le nom de la machine est affiché`,proxmox_show_controls:`Afficher les commandes`,proxmox_show_controls_help:`Si désactivé, le widget affiche uniquement l'état`,proxmox_uptime:`Temps de fonctionnement`,proxmox_show_uptime:`Afficher le temps de fonctionnement`,proxmox_show_icon:`Afficher l'icône`,proxmox_icon:`Icône`,proxmox_icon_help:`Si vide, le symbole du type est affiché`,proxmox_image:`Image`,proxmox_image_help:`Un fichier image, utilisé à la place de l'icône`,proxmox_show_details:`Afficher CPU et RAM`,proxmox_stop_command:`Bouton d'arrêt`,proxmox_stop_shutdown:`Éteindre proprement`,proxmox_stop_hard:`Couper immédiatement`,proxmox_ask_confirmation:`Demander avant l'arrêt`,proxmox_no_card:`Sans carte`,proxmox_no_machine:`Sélectionnez une VM ou un conteneur`,proxmox_start:`Démarrer`,proxmox_stop:`Arrêter`,proxmox_cancel:`Annuler`,proxmox_in_progress:`En cours…`,proxmox_unknown:`Inconnu`,proxmox_status_running:`En marche`,proxmox_status_stopped:`Arrêtée`,proxmox_status_paused:`En pause`,proxmox_status_suspended:`Suspendue`,proxmox_status_offline:`Hors ligne`,proxmox_confirm_shutdown:`Vraiment éteindre « %s » ?`,proxmox_confirm_hard:`Vraiment couper « %s » immédiatement, sans arrêt propre ? Les données non enregistrées peuvent être perdues.`,proxmox_command_failed:`La commande n'a pas pu être envoyée`,proxmox_node_widget_label:`Nœud Proxmox`,proxmox_node:`Nœud`,proxmox_node_help:`Le nœud Proxmox affiché par ce widget`,proxmox_node_title_help:`Si vide, le nom du nœud est affiché`,proxmox_no_node:`Sélectionnez un nœud`,proxmox_updates:`Mises à jour disponibles`,proxmox_updates_help:`Nécessite l'option « Demander les mises à jour disponibles » dans l'adaptateur`,proxmox_updates_control:`Afficher et actualiser`,proxmox_updates_show:`Afficher seulement`,proxmox_updates_hidden:`Ne pas afficher`,proxmox_status_online:`En ligne`,proxmox_update_available:`1 mise à jour`,proxmox_updates_available:`%s mises à jour`,proxmox_up_to_date:`À jour`,proxmox_refresh:`Actualiser`,proxmox_refresh_help:`Actualise la liste des paquets du nœud (apt update)`,proxmox_refreshing:`Actualisation…`,proxmox_more_updates:`… et %s de plus`,proxmox_updates_off:`Les mises à jour disponibles ne sont pas activées dans l'adaptateur`,proxmox_machine_id_help:`Le canal de la VM ou du conteneur, par exemple proxmox.0.lxc_web`,proxmox_node_id_help:`Le canal du nœud, par exemple proxmox.0.node_pve`,proxmox_not_machine:`Ce n'est ni une VM ni un conteneur de l'adaptateur Proxmox`,proxmox_not_node:`Ce n'est pas un nœud de l'adaptateur Proxmox`,proxmox_instance:`Instance`},it:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM o container`,proxmox_machine:`VM o container`,proxmox_machine_help:`La VM o il container mostrato da questo widget`,proxmox_title:`Titolo`,proxmox_title_help:`Se vuoto, viene mostrato il nome della macchina`,proxmox_show_controls:`Mostra i comandi`,proxmox_show_controls_help:`Se disattivato, il widget mostra solo lo stato`,proxmox_uptime:`Tempo di attività`,proxmox_show_uptime:`Mostra tempo di attività`,proxmox_show_icon:`Mostra icona`,proxmox_icon:`Icona`,proxmox_icon_help:`Se vuota, viene mostrato il simbolo del tipo`,proxmox_image:`Immagine`,proxmox_image_help:`Un file immagine, usato al posto dell'icona`,proxmox_show_details:`Mostra CPU e RAM`,proxmox_stop_command:`Pulsante di arresto`,proxmox_stop_shutdown:`Arresta regolarmente`,proxmox_stop_hard:`Spegni subito`,proxmox_ask_confirmation:`Chiedi prima dell'arresto`,proxmox_no_card:`Senza scheda`,proxmox_no_machine:`Seleziona una VM o un container`,proxmox_start:`Avvia`,proxmox_stop:`Ferma`,proxmox_cancel:`Annulla`,proxmox_in_progress:`In corso…`,proxmox_unknown:`Sconosciuto`,proxmox_status_running:`In esecuzione`,proxmox_status_stopped:`Ferma`,proxmox_status_paused:`In pausa`,proxmox_status_suspended:`Sospesa`,proxmox_status_offline:`Offline`,proxmox_confirm_shutdown:`Arrestare davvero "%s"?`,proxmox_confirm_hard:`Spegnere davvero "%s" subito, senza un arresto regolare? I dati non salvati possono andare persi.`,proxmox_command_failed:`Impossibile inviare il comando`,proxmox_node_widget_label:`Nodo Proxmox`,proxmox_node:`Nodo`,proxmox_node_help:`Il nodo Proxmox mostrato da questo widget`,proxmox_node_title_help:`Se vuoto, viene mostrato il nome del nodo`,proxmox_no_node:`Seleziona un nodo`,proxmox_updates:`Aggiornamenti disponibili`,proxmox_updates_help:`Richiede l'opzione «Richiedi aggiornamenti disponibili» nell'adattatore`,proxmox_updates_control:`Mostra e aggiorna`,proxmox_updates_show:`Solo mostra`,proxmox_updates_hidden:`Non mostrare`,proxmox_status_online:`Online`,proxmox_update_available:`1 aggiornamento`,proxmox_updates_available:`%s aggiornamenti`,proxmox_up_to_date:`Aggiornato`,proxmox_refresh:`Aggiorna`,proxmox_refresh_help:`Aggiorna l'elenco dei pacchetti del nodo (apt update)`,proxmox_refreshing:`Aggiornamento…`,proxmox_more_updates:`… e altri %s`,proxmox_updates_off:`Gli aggiornamenti disponibili non sono attivati nell'adattatore`,proxmox_machine_id_help:`Il canale della VM o del container, ad esempio proxmox.0.lxc_web`,proxmox_node_id_help:`Il canale del nodo, ad esempio proxmox.0.node_pve`,proxmox_not_machine:`Non è né una VM né un container dell'adattatore Proxmox`,proxmox_not_node:`Non è un nodo dell'adattatore Proxmox`,proxmox_instance:`Istanza`},es:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM o contenedor`,proxmox_machine:`VM o contenedor`,proxmox_machine_help:`La VM o el contenedor que muestra este widget`,proxmox_title:`Título`,proxmox_title_help:`Si está vacío, se muestra el nombre de la máquina`,proxmox_show_controls:`Mostrar controles`,proxmox_show_controls_help:`Si se desactiva, el widget solo muestra el estado`,proxmox_uptime:`Tiempo de actividad`,proxmox_show_uptime:`Mostrar tiempo de actividad`,proxmox_show_icon:`Mostrar icono`,proxmox_icon:`Icono`,proxmox_icon_help:`Si está vacío, se muestra el símbolo del tipo`,proxmox_image:`Imagen`,proxmox_image_help:`Un archivo de imagen, usado en lugar del icono`,proxmox_show_details:`Mostrar CPU y RAM`,proxmox_stop_command:`Botón de detener`,proxmox_stop_shutdown:`Apagar correctamente`,proxmox_stop_hard:`Apagar de inmediato`,proxmox_ask_confirmation:`Preguntar antes de detener`,proxmox_no_card:`Sin tarjeta`,proxmox_no_machine:`Seleccione una VM o un contenedor`,proxmox_start:`Iniciar`,proxmox_stop:`Detener`,proxmox_cancel:`Cancelar`,proxmox_in_progress:`En curso…`,proxmox_unknown:`Desconocido`,proxmox_status_running:`En ejecución`,proxmox_status_stopped:`Detenida`,proxmox_status_paused:`En pausa`,proxmox_status_suspended:`Suspendida`,proxmox_status_offline:`Sin conexión`,proxmox_confirm_shutdown:`¿Apagar realmente "%s"?`,proxmox_confirm_hard:`¿Apagar realmente "%s" de inmediato, sin un apagado correcto? Los datos no guardados pueden perderse.`,proxmox_command_failed:`No se pudo enviar el comando`,proxmox_node_widget_label:`Nodo Proxmox`,proxmox_node:`Nodo`,proxmox_node_help:`El nodo Proxmox que muestra este widget`,proxmox_node_title_help:`Si está vacío, se muestra el nombre del nodo`,proxmox_no_node:`Seleccione un nodo`,proxmox_updates:`Actualizaciones disponibles`,proxmox_updates_help:`Requiere la opción "Solicitar actualizaciones disponibles" en el adaptador`,proxmox_updates_control:`Mostrar y actualizar`,proxmox_updates_show:`Solo mostrar`,proxmox_updates_hidden:`No mostrar`,proxmox_status_online:`En línea`,proxmox_update_available:`1 actualización`,proxmox_updates_available:`%s actualizaciones`,proxmox_up_to_date:`Actualizado`,proxmox_refresh:`Actualizar`,proxmox_refresh_help:`Actualiza la lista de paquetes del nodo (apt update)`,proxmox_refreshing:`Actualizando…`,proxmox_more_updates:`… y %s más`,proxmox_updates_off:`Las actualizaciones disponibles no están activadas en el adaptador`,proxmox_machine_id_help:`El canal de la VM o del contenedor, por ejemplo proxmox.0.lxc_web`,proxmox_node_id_help:`El canal del nodo, por ejemplo proxmox.0.node_pve`,proxmox_not_machine:`No es ni una VM ni un contenedor del adaptador Proxmox`,proxmox_not_node:`No es un nodo del adaptador Proxmox`,proxmox_instance:`Instancia`},pl:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`VM lub kontener`,proxmox_machine:`VM lub kontener`,proxmox_machine_help:`Maszyna wirtualna lub kontener wyświetlany przez ten widżet`,proxmox_title:`Tytuł`,proxmox_title_help:`Jeśli pusty, wyświetlana jest nazwa maszyny`,proxmox_show_controls:`Pokaż sterowanie`,proxmox_show_controls_help:`Po wyłączeniu widżet pokazuje tylko stan`,proxmox_uptime:`Czas pracy`,proxmox_show_uptime:`Pokaż czas pracy`,proxmox_show_icon:`Pokaż ikonę`,proxmox_icon:`Ikona`,proxmox_icon_help:`Jeśli puste, wyświetlany jest symbol typu`,proxmox_image:`Obraz`,proxmox_image_help:`Plik obrazu, używany zamiast ikony`,proxmox_show_details:`Pokaż CPU i RAM`,proxmox_stop_command:`Przycisk zatrzymania`,proxmox_stop_shutdown:`Zamknij prawidłowo`,proxmox_stop_hard:`Wyłącz natychmiast`,proxmox_ask_confirmation:`Pytaj przed zatrzymaniem`,proxmox_no_card:`Bez karty`,proxmox_no_machine:`Wybierz VM lub kontener`,proxmox_start:`Uruchom`,proxmox_stop:`Zatrzymaj`,proxmox_cancel:`Anuluj`,proxmox_in_progress:`W toku…`,proxmox_unknown:`Nieznany`,proxmox_status_running:`Działa`,proxmox_status_stopped:`Zatrzymana`,proxmox_status_paused:`Wstrzymana`,proxmox_status_suspended:`Uśpiona`,proxmox_status_offline:`Offline`,proxmox_confirm_shutdown:`Na pewno wyłączyć „%s”?`,proxmox_confirm_hard:`Na pewno wyłączyć „%s” natychmiast, bez prawidłowego zamknięcia? Niezapisane dane mogą zostać utracone.`,proxmox_command_failed:`Nie udało się wysłać polecenia`,proxmox_node_widget_label:`Węzeł Proxmox`,proxmox_node:`Węzeł`,proxmox_node_help:`Węzeł Proxmox wyświetlany przez ten widżet`,proxmox_node_title_help:`Jeśli puste, wyświetlana jest nazwa węzła`,proxmox_no_node:`Wybierz węzeł`,proxmox_updates:`Dostępne aktualizacje`,proxmox_updates_help:`Wymaga opcji „Pobieraj dostępne aktualizacje” w adapterze`,proxmox_updates_control:`Pokaż i odśwież`,proxmox_updates_show:`Tylko pokaż`,proxmox_updates_hidden:`Nie pokazuj`,proxmox_status_online:`Online`,proxmox_update_available:`1 aktualizacja`,proxmox_updates_available:`Aktualizacje: %s`,proxmox_up_to_date:`Aktualny`,proxmox_refresh:`Odśwież`,proxmox_refresh_help:`Odświeża listę pakietów węzła (apt update)`,proxmox_refreshing:`Odświeżanie…`,proxmox_more_updates:`… i %s więcej`,proxmox_updates_off:`Dostępne aktualizacje nie są włączone w adapterze`,proxmox_machine_id_help:`Kanał maszyny wirtualnej lub kontenera, na przykład proxmox.0.lxc_web`,proxmox_node_id_help:`Kanał węzła, na przykład proxmox.0.node_pve`,proxmox_not_machine:`To nie jest maszyna wirtualna ani kontener adaptera Proxmox`,proxmox_not_node:`To nie jest węzeł adaptera Proxmox`,proxmox_instance:`Instancja`},uk:{proxmox_set_label:`Proxmox`,proxmox_widget_label:`ВМ або контейнер`,proxmox_machine:`ВМ або контейнер`,proxmox_machine_help:`ВМ або контейнер, які показує цей віджет`,proxmox_title:`Заголовок`,proxmox_title_help:`Якщо порожньо, показується ім'я машини`,proxmox_show_controls:`Показати керування`,proxmox_show_controls_help:`Якщо вимкнено, віджет лише показує стан`,proxmox_uptime:`Час роботи`,proxmox_show_uptime:`Показувати час роботи`,proxmox_show_icon:`Показувати значок`,proxmox_icon:`Значок`,proxmox_icon_help:`Якщо порожньо, показується значок типу`,proxmox_image:`Зображення`,proxmox_image_help:`Файл зображення, показується замість значка`,proxmox_show_details:`Показати CPU і RAM`,proxmox_stop_command:`Кнопка зупинки`,proxmox_stop_shutdown:`Коректно завершити роботу`,proxmox_stop_hard:`Негайно вимкнути`,proxmox_ask_confirmation:`Запитувати перед зупинкою`,proxmox_no_card:`Без картки`,proxmox_no_machine:`Виберіть ВМ або контейнер`,proxmox_start:`Запустити`,proxmox_stop:`Зупинити`,proxmox_cancel:`Скасувати`,proxmox_in_progress:`Виконується…`,proxmox_unknown:`Невідомо`,proxmox_status_running:`Працює`,proxmox_status_stopped:`Зупинена`,proxmox_status_paused:`На паузі`,proxmox_status_suspended:`Призупинена`,proxmox_status_offline:`Не в мережі`,proxmox_confirm_shutdown:`Дійсно вимкнути «%s»?`,proxmox_confirm_hard:`Дійсно негайно вимкнути «%s» без коректного завершення роботи? Незбережені дані можуть бути втрачені.`,proxmox_command_failed:`Не вдалося надіслати команду`,proxmox_node_widget_label:`Вузол Proxmox`,proxmox_node:`Вузол`,proxmox_node_help:`Вузол Proxmox, який показує цей віджет`,proxmox_node_title_help:`Якщо порожньо, показується назва вузла`,proxmox_no_node:`Виберіть вузол`,proxmox_updates:`Доступні оновлення`,proxmox_updates_help:`Потрібна опція «Запитувати доступні оновлення» в адаптері`,proxmox_updates_control:`Показувати й оновлювати`,proxmox_updates_show:`Лише показувати`,proxmox_updates_hidden:`Не показувати`,proxmox_status_online:`Онлайн`,proxmox_update_available:`1 оновлення`,proxmox_updates_available:`Оновлень: %s`,proxmox_up_to_date:`Актуально`,proxmox_refresh:`Оновити`,proxmox_refresh_help:`Оновлює список пакетів вузла (apt update)`,proxmox_refreshing:`Оновлення…`,proxmox_more_updates:`… і ще %s`,proxmox_updates_off:`Доступні оновлення не ввімкнені в адаптері`,proxmox_machine_id_help:`Канал ВМ або контейнера, наприклад proxmox.0.lxc_web`,proxmox_node_id_help:`Канал вузла, наприклад proxmox.0.node_pve`,proxmox_not_machine:`Це не ВМ і не контейнер адаптера Proxmox`,proxmox_not_node:`Це не вузол адаптера Proxmox`,proxmox_instance:`Екземпляр`},"zh-cn":{proxmox_set_label:`Proxmox`,proxmox_widget_label:`虚拟机或容器`,proxmox_machine:`虚拟机或容器`,proxmox_machine_help:`此小部件显示的虚拟机或容器`,proxmox_title:`标题`,proxmox_title_help:`留空时显示机器名称`,proxmox_show_controls:`显示控制按钮`,proxmox_show_controls_help:`禁用后，小部件仅显示状态`,proxmox_uptime:`运行时间`,proxmox_show_uptime:`显示运行时间`,proxmox_show_icon:`显示图标`,proxmox_icon:`图标`,proxmox_icon_help:`如果为空，则显示类型符号`,proxmox_image:`图片`,proxmox_image_help:`图片文件，用于代替图标`,proxmox_show_details:`显示 CPU 和内存`,proxmox_stop_command:`停止按钮`,proxmox_stop_shutdown:`正常关机`,proxmox_stop_hard:`立即断电`,proxmox_ask_confirmation:`停止前询问`,proxmox_no_card:`不使用卡片`,proxmox_no_machine:`请选择虚拟机或容器`,proxmox_start:`启动`,proxmox_stop:`停止`,proxmox_cancel:`取消`,proxmox_in_progress:`正在执行…`,proxmox_unknown:`未知`,proxmox_status_running:`运行中`,proxmox_status_stopped:`已停止`,proxmox_status_paused:`已暂停`,proxmox_status_suspended:`已挂起`,proxmox_status_offline:`离线`,proxmox_confirm_shutdown:`确定要关闭“%s”吗？`,proxmox_confirm_hard:`确定要立即断电“%s”，而不正常关机吗？未保存的数据可能会丢失。`,proxmox_command_failed:`无法发送命令`,proxmox_node_widget_label:`Proxmox 节点`,proxmox_node:`节点`,proxmox_node_help:`此小部件显示的 Proxmox 节点`,proxmox_node_title_help:`如果为空，则显示节点名称`,proxmox_no_node:`请选择节点`,proxmox_updates:`可用更新`,proxmox_updates_help:`需要在适配器中启用“获取可用更新”选项`,proxmox_updates_control:`显示并刷新`,proxmox_updates_show:`仅显示`,proxmox_updates_hidden:`不显示`,proxmox_status_online:`在线`,proxmox_update_available:`1 个更新`,proxmox_updates_available:`%s 个更新`,proxmox_up_to_date:`已是最新`,proxmox_refresh:`刷新`,proxmox_refresh_help:`刷新节点的软件包列表 (apt update)`,proxmox_refreshing:`正在刷新…`,proxmox_more_updates:`… 还有 %s 个`,proxmox_updates_off:`适配器中未启用可用更新`,proxmox_machine_id_help:`虚拟机或容器的通道，例如 proxmox.0.lxc_web`,proxmox_node_id_help:`节点的通道，例如 proxmox.0.node_pve`,proxmox_not_machine:`这不是 Proxmox 适配器的虚拟机或容器`,proxmox_not_node:`这不是 Proxmox 适配器的节点`,proxmox_instance:`实例`},prefix:`proxmox_`};function re(e,t,...n){let r=($[e]||$.en)[t]||$.en[t]||t;for(let e of n)r=r.replace(`%s`,e);return r}var ie=`
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it */
    container-type: size;
}
.edit {
    pointer-events: none;
}
.card {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: clamp(6px, 4cqmin, 14px);
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 4cqmin, 10px);
    overflow: hidden;
}
.head {
    display: flex;
    align-items: center;
    gap: clamp(6px, 4cqmin, 12px);
    min-width: 0;
}
.avatar {
    --state: var(--iob-text-secondary);
    flex: none;
    box-sizing: border-box;
    width: clamp(28px, 24cqmin, 48px);
    height: clamp(28px, 24cqmin, 48px);
    border-radius: 25%;
    display: grid;
    place-items: center;
    color: #fff;
    background: var(--state);
    transition: background-color 0.3s;
}
.avatar svg {
    width: 60%;
    height: 60%;
}
.titles {
    flex: 1;
    min-width: 0;
}
.name {
    font-weight: 600;
    font-size: clamp(12px, 9cqmin, 17px);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.meta {
    display: flex;
    align-items: center;
    gap: 0.7em;
    min-width: 0;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 7cqmin, 13px);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
}
.meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
}
.meta svg {
    width: 1.1em;
    height: 1.1em;
    flex: none;
}
.pill {
    --state: var(--iob-text-secondary);
    flex: none;
    max-width: 100%;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.15em 0.75em;
    border-radius: 999px;
    color: var(--state);
    background: color-mix(in srgb, var(--state) 16%, transparent);
    font-size: clamp(10px, 7cqmin, 13px);
    font-weight: 700;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pill svg {
    width: 1.15em;
    height: 1.15em;
    flex: none;
}
.success {
    --state: var(--iob-success);
}
.warning {
    --state: var(--iob-warning);
}
.error {
    --state: var(--iob-error);
}
.neutral {
    --state: var(--iob-text-secondary);
}
.unknown {
    --state: color-mix(in srgb, var(--iob-text-secondary) 60%, transparent);
}
.bars {
    display: flex;
    gap: clamp(8px, 5cqmin, 16px);
}
.bar {
    flex: 1 1 0;
    min-width: 0;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 6.5cqmin, 12px);
}
.bar .labels {
    display: flex;
    justify-content: space-between;
    gap: 0.4em;
    white-space: nowrap;
}
.bar .labels span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
}
.bar .track {
    height: 5px;
    margin-top: 2px;
    border-radius: 3px;
    overflow: hidden;
    background: color-mix(in srgb, var(--iob-text-secondary) 25%, transparent);
}
.bar .fill {
    height: 100%;
    background: var(--state);
    transition: width 0.3s;
}
.actions {
    margin-top: auto;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
}
.actions .pill {
    flex: 0 1 auto;
}
.actions .push {
    margin-left: auto;
}
button {
    --btn: var(--iob-primary);
    font: inherit;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    min-width: 0;
    padding: 0.35em 0.9em;
    border-radius: var(--iob-border-radius);
    border: 1px solid var(--btn);
    color: #fff;
    background: var(--btn);
    font-size: clamp(11px, 7cqmin, 14px);
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s;
}
button:hover:not(:disabled) {
    filter: brightness(1.1);
}
button:focus-visible {
    outline: 2px solid var(--btn);
    outline-offset: 2px;
}
button:disabled {
    opacity: 0.4;
    cursor: default;
}
button svg {
    width: 1.15em;
    height: 1.15em;
    flex: none;
}
button.outlined {
    color: var(--btn);
    background: transparent;
}
button.start {
    --btn: var(--iob-success);
}
button.hard {
    --btn: var(--iob-error);
}
.failed {
    color: var(--iob-error);
    font-size: clamp(10px, 6.5cqmin, 12px);
}
.hint {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 8px);
    overflow: hidden;
    text-align: center;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 7cqmin, 15px);
}
.hint svg {
    width: clamp(16px, 14cqmin, 32px);
    height: clamp(16px, 14cqmin, 32px);
    fill: currentColor;
}

/* no room for the bars */
@container (max-height: 129px) {
    .bars {
        display: none;
    }
}

/* a tile: everything centered below each other, the buttons without words */
@container (max-width: 219px) {
    .card {
        align-items: center;
        justify-content: center;
        text-align: center;
    }
    .head {
        flex-direction: column;
        max-width: 100%;
    }
    .titles {
        width: 100%;
    }
    .meta {
        justify-content: center;
    }
    .bars {
        display: none;
    }
    .actions {
        margin-top: 0;
        justify-content: center;
    }
    .actions .push {
        margin-left: 0;
    }
    button .word {
        display: none;
    }
    button {
        padding: 0.35em 0.6em;
    }
}

/* one row: the buttons at the right of the name */
@container (max-height: 100px) and (min-width: 220px) {
    .card {
        flex-direction: row;
        align-items: center;
    }
    .head {
        flex: 1;
    }
    .actions {
        margin-top: 0;
        flex-wrap: nowrap;
    }
    button .word {
        display: none;
    }
}
@container (max-height: 52px) {
    .meta {
        display: none;
    }
}
`,ae=class extends k{root;constructor(){super();let e=this.attachShadow({mode:`open`}),t=document.createElement(`style`);t.textContent=ie;let r=document.createElement(`div`);r.className=`mount`,e.append(t,r),this.root=n(r)}getObjectIds(e){let t=this.getChannelOf(e);return t?[t]:[]}getStateIds(e){let t=this.getChannelOf(e);return t?this.getStateNames().map(e=>`${t}.${e}`):[]}getChannelId(){return this.getChannelOf(this.settings)}word(e,...t){return re(this.systemLang,e,...t)}getChannelState(e){return this.states[`${this.getChannelId()}.${e}`]??null}stateValue(e){return this.getChannelState(e)?.val}getStatus(){let e=this.stateValue(`status`);return typeof e==`string`?e:``}getStatusKind(){return I(this.getStatus())}getChannelType(){return G(this.objects[this.getChannelId()])}checkChannel(){let e=this.getChannelId();if(!e)return`missing`;let t=this.objects[e];return t===void 0?`reading`:this.getChannelTypes().includes(G(t))?`ok`:`wrong`}getDisplayName(){let e=this.getChannelId();return this.settings.name?.trim()||this.text(this.objects[e]?.common?.name)||e.split(`.`).pop()||``}async confirm(e){return await this.openDialog({title:this.getDisplayName(),form:{type:`panel`,items:{question:{type:`staticText`,text:e}}}})!==null}};A(J,class extends ae{#e=null;#t=null;#n=``;getChannelOf(e){return e.node?.trim()||``}getStateNames(){return M}getChannelTypes(){return j}disconnectedCallback(){super.disconnectedCallback(),this.#r()}#r(){this.#t&&=(clearTimeout(this.#t),null),this.#e=null}#i(){let e=this.settings.updates;return e===`show`||e===`hidden`?e:`control`}#a(){let e=this.getChannelId();!this.editMode&&e&&(this.#r(),this.#e={before:this.getChannelState(`updates.refresh`)?.ts??null,channelId:e},this.#n=``,this.#t=setTimeout(()=>{this.#t=null,this.#e=null,this.render()},P),this.render(),this.setState(`${e}.${N}`,!0).catch(()=>{this.#r(),this.#n=e,this.render()}))}#o(t){if(t<=0)return/* @__PURE__ */ e(Z,{kind:`success`,icon:`upToDate`,label:this.word(`proxmox_up_to_date`)});let n=U(this.stateValue(`updates.list`)),r=n.slice(0,15).map(W);return n.length>15&&r.push(this.word(`proxmox_more_updates`,String(n.length-15))),/* @__PURE__ */ e(Z,{kind:`warning`,icon:`update`,label:t===1?this.word(`proxmox_update_available`):this.word(`proxmox_updates_available`,String(t)),title:r.join(`
`)})}render(){let n=this.checkChannel();if(n===`missing`||n===`wrong`){this.root.render(/* @__PURE__ */ e(ne,{text:this.word(n===`missing`?`proxmox_no_node`:`proxmox_not_node`),editMode:this.editMode}));return}let r=this.settings,i=this.getChannelId(),a=this.getChannelState(N),o=this.#e;o&&(o.channelId!==i||a?.ack&&a.ts!==o.before)&&this.#r();let s=this.getStatus(),c=this.#i(),l=this.stateValue(`updates.count`),u=c!==`hidden`&&typeof l==`number`,d=F.includes(s)?this.word(`proxmox_status_${s}`):s||this.word(`proxmox_unknown`),f=this.stateValue(`cpu`),p=this.stateValue(`cpu_max`),m=this.stateValue(`memory.used_lev`),h=!!this.#e;this.root.render(/* @__PURE__ */ t(`div`,{className:this.editMode?`card edit`:`card`,children:[/* @__PURE__ */ e(X,{type:`node`,kind:this.getStatusKind(),name:this.getDisplayName(),typeName:H(`node`),uptime:r.showUptime===!1?``:L(this.stateValue(`uptime`)),uptimeLabel:this.word(`proxmox_uptime`),status:/* @__PURE__ */ e(Z,{kind:this.getStatusKind(),label:d})}),r.showDetails===!1?null:/* @__PURE__ */ t(`div`,{className:`bars`,children:[/* @__PURE__ */ e(Q,{label:typeof p==`number`&&p>0?`${p} CPU`:`CPU`,percent:typeof f==`number`?f:void 0,text:typeof f==`number`?`${f} %`:`–`}),/* @__PURE__ */ e(Q,{label:`RAM`,percent:typeof m==`number`?m:void 0,text:B(this.stateValue(`memory.used`),this.stateValue(`memory.total`),m)})]}),this.#n===i&&i?/* @__PURE__ */ e(`div`,{className:`failed`,children:this.word(`proxmox_command_failed`)}):null,u?/* @__PURE__ */ t(`div`,{className:`actions`,children:[this.#o(l),c===`control`?/* @__PURE__ */ e(`span`,{className:`push`,children:/* @__PURE__ */ e(te,{className:`outlined`,icon:`refresh`,label:this.word(h?`proxmox_refreshing`:`proxmox_refresh`),title:this.word(h?`proxmox_refreshing`:`proxmox_refresh_help`),disabled:h||this.editMode||s!==`online`,onClick:()=>this.#a()})}):null]}):null]}))}});