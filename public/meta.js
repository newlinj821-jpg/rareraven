const MANUFACTURER={
  'velocicoaster':'Intamin','hagrids':'Intamin','hippogriff':'Vekoma','hulk-ioa':'Bolliger & Mabillard',
  'mummy-orlando':'Premier Rides','trolls':'Zierer','gringotts':'Intamin','stardust':'Mack Rides',
  'werewolf':'Mack Rides','wing-gliders':'Intamin','tron':'Vekoma','seven-dwarfs':'Vekoma',
  'guardians':'Vekoma','slinky':'Mack Rides','rocknroller':'Vekoma','everest':'Vekoma',
  'mako':'Bolliger & Mabillard','manta-orlando':'Bolliger & Mabillard','kraken':'Bolliger & Mabillard',
  'ice-breaker':'Premier Rides','pipeline':'Bolliger & Mabillard','penguin-trek':'Bolliger & Mabillard',
  'iron-gwazi':'Rocky Mountain Construction','montu':'Bolliger & Mabillard','kumba':'Bolliger & Mabillard',
  'cheetah-hunt':'Intamin','sheikra':'Bolliger & Mabillard','tigris':'Premier Rides','cobras-curse':'Mack Rides',
  'phoenix-rising':'Bolliger & Mabillard','millennium-force':'Intamin','steel-vengeance':'Rocky Mountain Construction',
  'maverick':'Intamin','gatekeeper':'Bolliger & Mabillard','valravn':'Bolliger & Mabillard','raptor':'Bolliger & Mabillard',
  'rougarou':'Bolliger & Mabillard','magnum':'Arrow Dynamics','gemini':'Arrow Dynamics','corkscrew-cp':'Arrow Dynamics',
  'iron-dragon':'Arrow Dynamics','wild-mouse-cp':'Zamperla','siren':'Vekoma','top-thrill-2':'Zamperla',
  'orion':'Bolliger & Mabillard','diamondback':'Bolliger & Mabillard','mystic-timbers':'Great Coasters International',
  'banshee':'Bolliger & Mabillard','flight-of-fear-ki':'Premier Rides','beast':'Kings Island',
  'candymonium':'Bolliger & Mabillard','wildcats-revenge':'Rocky Mountain Construction','skyrush':'Intamin',
  'great-bear':'Bolliger & Mabillard','storm-runner':'Intamin','fahrenheit':'Intamin',
  'jersey-devil':'Rocky Mountain Construction','nitro':'Bolliger & Mabillard','el-toro':'Intamin',
  'medusa-sfga':'Bolliger & Mabillard','batman-sfga':'Bolliger & Mabillard','superman-sfga':'Bolliger & Mabillard',
  'twisted-colossus':'Rocky Mountain Construction','tatsu':'Bolliger & Mabillard','full-throttle':'Premier Rides',
  'west-coast-racers':'Premier Rides','wonder-woman-sfmm':'Rocky Mountain Construction','goliath-sfmm':'Giovanola',
  'riddler-sfmm':'Bolliger & Mabillard','maxx-force':'S&S Worldwide','goliath-sfgam':'Rocky Mountain Construction',
  'raging-bull':'Bolliger & Mabillard','x-flight':'Bolliger & Mabillard','batman-sfgam':'Bolliger & Mabillard',
  'superman-sfgam':'Bolliger & Mabillard','wrath-rakshasa':'Bolliger & Mabillard',
  'fury-325':'Bolliger & Mabillard','copperhead':'Mack Rides','afterburn':'Bolliger & Mabillard',
  'thunder-striker':'Bolliger & Mabillard','lightning-rod':'Rocky Mountain Construction','wild-eagle':'Bolliger & Mabillard',
  'mystery-mine':'Gerstlauer','tennessee-tornado':'Arrow Dynamics','firechaser':'Gerstlauer','dragonflier':'Vekoma',
  'big-bear-mountain':'Vekoma','time-traveler':'Mack Rides','outlaw-run':'Rocky Mountain Construction',
  'powder-keg':'S&S Worldwide','wildfire-sdc':'Bolliger & Mabillard','pantheon':'Intamin',
  'apollos-chariot':'Bolliger & Mabillard','alpengeist':'Bolliger & Mabillard','griffon':'Bolliger & Mabillard',
  'verbolten':'Zierer','invadr':'Great Coasters International','ghostrider':'Custom Coasters International',
  'hangtime':'Gerstlauer','silver-bullet':'Bolliger & Mabillard','xcelerator':'Intamin',
  'incredicoaster':'Intamin','mummy-hollywood':'Premier Rides','hollywood-drift':'Intamin',
  'arctic-rescue':'Intamin','emperor':'Bolliger & Mabillard','electric-eel':'Premier Rides','manta-sd':'Mack Rides',
  'storm-chaser':'Rocky Mountain Construction','lightning-run':'Chance Rides','patriot-wof':'Bolliger & Mabillard',
  'mamba':'Morgan','prowler':'Great Coasters International','renegade':'Great Coasters International',
  'steel-venom':'Intamin','shivering-timbers':'Custom Coasters International','pantherian':'Intamin',
  'rapterra':'Bolliger & Mabillard','twisted-timbers':'Rocky Mountain Construction','dominator-kd':'Bolliger & Mabillard',
  'iron-menace':'Bolliger & Mabillard','steel-force':'Morgan','talon':'Bolliger & Mabillard','hydra':'Bolliger & Mabillard',
  'gold-striker':'Great Coasters International','railblazer':'Rocky Mountain Construction',
  'tormenta':'Bolliger & Mabillard','new-texas-giant':'Rocky Mountain Construction','iron-rattler':'Rocky Mountain Construction',
  'wonder-woman-sfft':'Rocky Mountain Construction','dr-diabolical':'Bolliger & Mabillard',
  'goliath-sfog':'Bolliger & Mabillard','twisted-cyclone':'Rocky Mountain Construction',
  'superman-sfne':'Intamin','wicked-cyclone':'Rocky Mountain Construction','quantum-accelerator':'Intamin',
  'medusa-sfdk':'Bolliger & Mabillard','joker-sfdk':'Rocky Mountain Construction','ride-of-steel-dl':'Intamin',
  'phoenix-knoebels':'Philadelphia Toboggan Coasters','phantoms-revenge':'D.H. Morgan','steel-curtain':'S&S Worldwide',
  'cannibal':'Lagoon','primordial':'ART Engineering','monster-ia':'Gerstlauer','matugani':'Intamin',
  'arieforce-one':'Rocky Mountain Construction','ravine-flyer-ii':'The Gravity Group','boulder-dash':'Custom Coasters International',
  'tmnt-shellraiser':'Gerstlauer','hades-360':'The Gravity Group','untamed-canobie':'Gerstlauer'
};

const VISUALS={
  'velocicoaster':{file:'VelociCoaster 1.jpg',credit:'Eric A. Soto · CC BY-SA 2.0'},
  'millennium-force':{file:'Millennium Force (Final Airtime).JPG',credit:'Coasterman1234 · Wikimedia Commons'},
  'steel-vengeance':{file:'Steel Vengeance Cedar Point (53161810238).jpg',credit:'Jeremy Thompson · CC BY 2.0'},
  'storm-runner':{file:'Hersheypark Storm Runner.jpg',credit:'Mike Romano · Public Domain'},
  'fury-325':{file:'Fury 325 (Carowinds) 1.jpg',credit:'Martin Lewison · Wikimedia Commons'},
  'iron-gwazi':{file:'Iron Gwazi - Busch Gardens Tampa.jpg',credit:'Railfan99 · CC BY-SA 4.0'}
};

const PARK_FEATURE={
  'ioa':'velocicoaster','cp':'millennium-force','hp':'storm-runner','carowinds':'fury-325','bgt':'iron-gwazi'
};

export function manufacturerFor(coaster){
  return MANUFACTURER[coaster?.id]||'Unknown';
}

export function coasterVisual(id,width=900){
  const item=VISUALS[id];
  if(!item) return null;
  return {
    url:`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(item.file)}?width=${width}`,
    credit:item.credit,
    file:item.file,
    exact:true
  };
}

export function parkVisual(){
  // Park imagery is resolved by exact park name through the server-side resolver.
  return null;
}

export function creditHeroVisual(width=1600){
  const file='Hershey Park roller coaster at night.jpg';
  return {
    url:`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=${width}`,
    credit:'Librarian1984 · CC BY-SA 4.0',
    file
  };
}

export function shortType(coaster){
  return String(coaster?.classification||'Unclassified').split('/')[0].trim();
}
