const KEY='coasterverse.private.v1';
const blank=()=>({version:1,rides:[],customCoasters:[]});
export function loadState(){try{return {...blank(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return blank()}}
export function saveState(state){localStorage.setItem(KEY,JSON.stringify(state))}
export function resetState(){localStorage.removeItem(KEY)}
export function exportState(state){return JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)}
export function importState(raw){const data=JSON.parse(raw);if(!data||!Array.isArray(data.rides)||!Array.isArray(data.customCoasters))throw new Error('Invalid CoasterVerse backup');return {version:1,rides:data.rides,customCoasters:data.customCoasters}}
