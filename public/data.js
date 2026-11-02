import {PARKS} from './db/parks.js';
import c1 from './db/coasters-1.js';
import c2 from './db/coasters-2.js';
import c3 from './db/coasters-3.js';
import c4 from './db/coasters-4.js';
import c5 from './db/coasters-5.js';

export {PARKS};
export const COASTERS=[...c1,...c2,...c3,...c4,...c5];
export const parkById=new Map(PARKS.map(p=>[p.id,p]));
export const coasterById=new Map(COASTERS.map(c=>[c.id,c]));
export const formatLocation=p=>[p.city,p.state,p.country].filter(Boolean).join(', ');
