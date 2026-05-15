<script lang="ts">
  import { Banana, Zap, Gauge, Droplet, ChevronDown, ChevronRight, RotateCcw, User, Ruler, Scale, Wheat, CheckCircle, Check, Info, RefreshCw, X, Bike, ExternalLink, Trophy, Lock } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { linear, cubicOut } from 'svelte/easing';
  import { fly, fade, slide } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';

  // Named versions — women who shaped cycling
  const VERSION = '1.0';
  const BUILD_NAME = 'Marianne Vos';

  let updateAvailable = false;
  let doUpdateSW: () => Promise<void>;

  const swUpdate = registerSW({
    async onNeedRefresh() {
      try {
        const res = await fetch(`/version.json?_=${Date.now()}`);
        if (!res.ok) { swUpdate(false); return; }
        const data = await res.json();
        if (data.version !== VERSION || data.build !== BUILD_NAME) {
          updateAvailable = true;
        } else {
          swUpdate(false); // same version — apply silently, no reload
        }
      } catch {
        swUpdate(false); // can't determine version — apply silently
      }
    },
    onOfflineReady() {},
  });
  doUpdateSW = swUpdate;
  const CHANGELOG_ITEMS = [
    'Pack tab — gear checklist auto-generated from your ride',
    'One-tap install on Android Chrome via native browser prompt',
    'Swipe-to-dismiss on install sheet',
    'Emergency gel only added on rides ≥ 2h',
    'Contrast fixes across all dark cards (WCAG AA throughout)',
  ];
  let showWhatsNew = false;
  let showChangelogSheet = false;
  function dismissChangelog() {
    showChangelogSheet = false;
    showWhatsNew = false;
    localStorage.setItem('bs-seen-build', BUILD_NAME);
  }

  type RiderInfo = { specialty: string; bio: string; wins: string[] };
  const RIDER_INFO: Record<string, RiderInfo> = {
    'Marianne Vos':              { specialty: 'All-rounder',    bio: 'The greatest women\'s cyclist of all time — world champion on road, track, and cyclo-cross.', wins: ['23× World Champion', '3× Olympic gold', '8× Giro Donne'] },
    'Annemiek van Vleuten':      { specialty: 'Climber / TT',   bio: 'Dominant grand tour racer and Olympic champion who attacked relentlessly until her last race.', wins: ['Olympic TT gold 2020', '4× Giro Donne', 'Tour de France Femmes 2022'] },
    'Anna van der Breggen':      { specialty: 'Climber',        bio: 'Six-time La Flèche Wallonne winner and Olympic champion, now shaping the next generation as a DS.', wins: ['Olympic gold 2016', '6× La Flèche Wallonne', 'World Champion 2018'] },
    'Lizzie Deignan':            { specialty: 'Classics',       bio: 'Won the inaugural Paris–Roubaix Femmes in 2021 and is a former world champion.', wins: ['Paris–Roubaix 2021', 'World Champion 2015', 'La Flèche Wallonne 2016'] },
    'Nicole Cooke':              { specialty: 'All-rounder',    bio: 'Won Olympic gold and the world title in the same year (2008), a feat never repeated.', wins: ['Olympic gold 2008', 'World Champion 2008', '2× Grande Boucle'] },
    'Emma Pooley':               { specialty: 'Climber / TT',   bio: 'World TT champion and Olympic silver medallist — a tiny rider who punched far above her weight.', wins: ['World TT Champion 2010', 'Olympic silver 2008', 'La Flèche Wallonne 2010'] },
    'Chantal van den Broek-Blaak': { specialty: 'Classics',    bio: '2018 world champion and winner of Strade Bianche and Paris–Roubaix Femmes.', wins: ['World Champion 2018', 'Paris–Roubaix 2022', 'Strade Bianche 2018'] },
    'Amy Pieters':               { specialty: 'Track / Sprint', bio: 'World Madison champion whose comeback from a serious crash in 2021 has been an inspiration.', wins: ['World Madison Champion', 'Tour de Wallonie 2020', 'Omloop Het Nieuwsblad 2019'] },
    'Ashleigh Moolman-Pasio':    { specialty: 'Climber',        bio: 'South Africa\'s greatest cyclist and a tireless advocate for growing women\'s professional racing.', wins: ['5× SA National Champion', 'Giro Donne stage wins', 'Commonwealth silver 2014'] },
    'Demi Vollering':            { specialty: 'Climber',        bio: '2023 Tour de France Femmes winner and reigning world number one.', wins: ['Tour de France Femmes 2023', 'World Champion 2023', 'La Flèche Wallonne 2023'] },
    'Lotte Kopecky':             { specialty: 'Classics',       bio: '2023–24 world champion, winner of Strade Bianche and Paris–Roubaix in the same season.', wins: ['World Champion 2023–24', 'Paris–Roubaix 2024', 'Strade Bianche 2022–23'] },
    'Cecilie Uttrup Ludwig':     { specialty: 'Climber',        bio: 'Known for fearless mountain attacks and an expressive racing style that wins fans worldwide.', wins: ['La Flèche Wallonne 2021', 'Giro Donne stage wins', '4× Danish Champion'] },
    'Elisa Longo Borghini':      { specialty: 'Classics',       bio: 'Paris–Roubaix winner and one of the most consistent podium riders of her generation.', wins: ['Paris–Roubaix 2021', 'Strade Bianche 2020', '3× Italian Champion'] },
    'Pauline Ferrand-Prévot':    { specialty: 'All-terrain',    bio: 'The only rider to hold road, MTB, and cyclo-cross world titles simultaneously (2015).', wins: ['Road World Champion 2014', 'MTB World Champion 2015', 'CX World Champion 2015'] },
    'Katarzyna Niewiadoma':      { specialty: 'Climber',        bio: '2024 Tour de France Femmes winner and Poland\'s greatest ever cyclist.', wins: ['Tour de France Femmes 2024', 'Vuelta Femenina podium', 'La Flèche Wallonne 2022'] },
    'Grace Brown':               { specialty: 'TT / Classics',  bio: '2024 Olympic TT champion and a breakaway specialist who makes the race every time she starts.', wins: ['Olympic TT gold 2024', 'Paris–Roubaix 2023', 'Liège–Bastogne–Liège 2023'] },
    'Elisa Balsamo':             { specialty: 'Sprinter',       bio: '2021 world champion and Paris–Roubaix winner with an explosive finish.', wins: ['World Champion 2021', 'Paris–Roubaix 2022', 'Tour de France Femmes stages'] },
    'Lorena Wiebes':             { specialty: 'Sprinter',       bio: 'The most dominant sprinter of her era with an almost unbroken record in bunch finishes.', wins: ['30+ World Tour wins', 'Tour de France Femmes sprints', 'Scheldeprijs 2022–23'] },
    'Ellen van Dijk':            { specialty: 'TT',             bio: 'Multiple world TT champion and former hour record holder — pure power on two wheels.', wins: ['4× World TT Champion', 'Hour record 2022', 'Olympic bronze 2020'] },
    'Marlen Reusser':            { specialty: 'TT / Classics',  bio: 'Olympic TT silver medallist and multiple world TT medallist, late starter who made it count.', wins: ['Olympic TT silver 2020', '2× World TT silver', 'Paris–Roubaix 2022 podium'] },
    'Kristen Faulkner':          { specialty: 'All-rounder',    bio: '2024 Olympic road race champion — a former Harvard rower who turned pro and took gold.', wins: ['Olympic road gold 2024', 'Giro Donne 2024', '2× US National Champion'] },
    'Chloé Dygert':              { specialty: 'TT',             bio: 'The most dominant TT specialist of her generation, fighting back from a devastating crash.', wins: ['5× World TT Champion', 'Olympic silver 2020', 'Pan American gold 2019'] },
    'Marta Cavalli':             { specialty: 'Climber',        bio: 'La Flèche Wallonne winner with a punchy, aggressive climbing style.', wins: ['La Flèche Wallonne 2022', 'Liège–Bastogne–Liège 2022', 'Giro Donne podium'] },
    'Juliette Labous':           { specialty: 'Climber',        bio: 'France\'s most consistent grand tour climber, always close to the podium.', wins: ['Tour de France Femmes podium', 'Vuelta Femenina stage wins', '2× French Champion'] },
    'Liane Lippert':             { specialty: 'Climber',        bio: 'German champion known for attacking racing and stage wins at the highest level.', wins: ['Strade Bianche 2021', '3× German Champion', 'Giro Donne stage wins'] },
    'Leah Thomas':               { specialty: 'All-rounder',    bio: 'US national champion and grand tour stage winner with a smooth all-round skill set.', wins: ['2× US National Champion', 'Tour de France Femmes stage', 'Setmana Ciclista Valencia'] },
    'Pfeiffer Georgi':           { specialty: 'Sprinter',       bio: 'British champion and rising sprint star making her mark on the World Tour.', wins: ['British National Champion', 'Tour de France Femmes stage 2024', 'Santos Women\'s Tour wins'] },
    'Soraya Paladin':            { specialty: 'Classics',       bio: 'Breakaway specialist and Strade Bianche podium finisher with a fighter\'s mentality.', wins: ['Strade Bianche podium', 'Durango–Durango winner', 'Multiple WT stage wins'] },
    'Marta Bastianelli':         { specialty: 'Sprinter',       bio: 'Veteran sprinter and former world champion still winning races after two decades as a pro.', wins: ['World Champion 2007', 'Multiple WT wins', 'Italian National Champion'] },
    'Silvia Persico':            { specialty: 'All-rounder',    bio: 'Italian champion and one-day race specialist with a knack for the decisive move.', wins: ['Italian National Champion', 'Gran Piemonte winner', 'Giro Donne stage wins'] },
    'Gaia Realini':              { specialty: 'Climber',        bio: 'Italy\'s brightest young climber — stage winner at the Vuelta Femenina before turning 23.', wins: ['Vuelta Femenina stage wins', 'Tour de Suisse Femmes', 'Italian U23 Champion'] },
    'Puck Pieterse':             { specialty: 'All-terrain',    bio: 'Dutch superstar of the next generation dominating cross, MTB, and road alike.', wins: ['CX World Champion 2024', 'MTB World Cup wins', 'Amstel Gold Race 2024'] },
    'Fem van Empel':             { specialty: 'Cyclo-cross',    bio: 'Dominant cyclo-cross world champion crossing over to road with the same ruthless efficiency.', wins: ['2× CX World Champion', 'CX World Cup overall', 'Tour de France Femmes stage 2024'] },
    'Shirin van Anrooij':        { specialty: 'All-terrain',    bio: 'Cyclo-cross and road talent who is quietly building one of the most complete palmares in the peloton.', wins: ['CX World Champion 2023', 'Dutch CX Champion', 'Tour de France Femmes stage'] },
    'Mischa Bredewold':          { specialty: 'Classics',       bio: '2023 Paris–Roubaix Femmes winner in only her second pro season.', wins: ['Paris–Roubaix 2023', 'Omloop Het Nieuwsblad 2024', 'Dutch National Champion'] },
    'Niamh Fisher-Black':        { specialty: 'Climber',        bio: 'New Zealand\'s grand tour climber with a cool head in the hardest mountain finishes.', wins: ['NZ National Champion', 'Vuelta Femenina stage wins', 'Tour de Romandie podium'] },
    'Riejanne Markus':           { specialty: 'All-rounder',    bio: 'Versatile rider who delivers as both a loyal domestique and a stage winner in her own right.', wins: ['Tour de France Femmes stage', 'Healthy Ageing Tour GC', 'Dutch CX podiums'] },
    'Sara Martín':               { specialty: 'Climber',        bio: 'Spanish climbing talent pushing for a podium at her home race, La Vuelta Femenina.', wins: ['Vuelta Femenina stage wins', 'Spanish National Champion', 'Giro Donne stage'] },
    'Brodie Chapman':            { specialty: 'All-rounder',    bio: 'Australian all-rounder who combines breakaway instinct with solid grand tour climbing.', wins: ['Tour de France Femmes stage 2022', 'Santos Women\'s Tour stage', 'Australian podiums'] },
    'Laura Kenny':               { specialty: 'Track',          bio: 'Britain\'s most decorated female Olympian — six Olympic golds on the velodrome.', wins: ['6× Olympic gold', '14× World Champion', 'Commonwealth gold 2022'] },
    'Katie Archibald':           { specialty: 'Track',          bio: 'Olympic and world champion on the track, and increasingly dangerous on the road too.', wins: ['Olympic gold 2020 & 2024', '10× World Champion', 'European Champion'] },
    'Elinor Barker':             { specialty: 'Track',          bio: 'Multiple Olympic gold medallist on the track and a key part of Britain\'s team pursuit dynasty.', wins: ['Olympic gold 2016 & 2020', '5× World Champion', 'Commonwealth gold'] },
    'Amanda Spratt':             { specialty: 'Climber',        bio: 'Australian climbing specialist and Strade Bianche winner who led the sport with quiet excellence.', wins: ['Strade Bianche 2019', '2× Oceania Champion', 'Giro Donne GC podium'] },
    'Georgia Baker':             { specialty: 'Track / Sprint', bio: 'Australian track champion converting velodrome speed into road race wins.', wins: ['Olympic gold 2024', 'World Madison Champion', 'Australian National Champion'] },
    'Alison Jackson':            { specialty: 'Sprinter',       bio: '2024 Paris–Roubaix Femmes winner — proof that anything can happen on the cobbles.', wins: ['Paris–Roubaix 2024', 'Tour de France Femmes stage 2023', 'Canadian National Champion'] },
    'Neve Bradbury':             { specialty: 'Track',          bio: 'Australian track specialist with Olympic and world championship medals to her name.', wins: ['Olympic silver 2020', 'World Championship medals', 'Australian Track Champion'] },
    'Clara Koppenburg':          { specialty: 'Climber',        bio: 'German climbing specialist who shines on the steepest gradients in women\'s racing.', wins: ['German National Champion', 'Tour de France Femmes stage', 'Giro Donne stage wins'] },
    'Vittoria Bussi':            { specialty: 'TT / Hour record', bio: 'Hour record holder and TT specialist who combines athletic power with an academic\'s precision.', wins: ['Hour record 2018 & 2022', 'Italian TT Champion', 'World TT podiums'] },
    'Leah Kirchmann':            { specialty: 'All-rounder',    bio: 'Canadian veteran and grand tour stage winner who helped build women\'s cycling in North America.', wins: ['Canadian National Champion', 'Giro Donne stage wins', 'Colorado Classic GC'] },
    'Alexis Ryan':               { specialty: 'All-rounder',    bio: 'American stage race specialist known for smart racing and aggressive attacking from distance.', wins: ['Tour de Yorkshire stage', 'Setmana Ciclista Valencia stage', 'US podiums'] },
    'Hannah Barnes':             { specialty: 'All-rounder',    bio: 'British veteran who combined a long pro career with advocacy for better conditions in women\'s cycling.', wins: ['British National Champion', 'Tour de Yorkshire stage', 'OVO Women\'s Tour stage'] },
  };
  let showRiderCard = false;
  const currentRider = RIDER_INFO[BUILD_NAME];

  const PCS_SLUG = BUILD_NAME.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Piecewise linear carb oxidation by IF (Jeukendrup 2004 / ACSM guidelines)
  function carbsFromIF(if_val: number): number {
    if (if_val <= 0)    return 0;
    if (if_val < 0.55)  return Math.round((if_val / 0.55) * 20);            // 0–20 g/h
    if (if_val < 0.75)  return Math.round(20 + (if_val - 0.55) / 0.20 * 20); // 20–40 g/h
    if (if_val < 0.90)  return Math.round(40 + (if_val - 0.75) / 0.15 * 20); // 40–60 g/h
    if (if_val < 1.05)  return Math.round(60 + (if_val - 0.90) / 0.15 * 30); // 60–90 g/h
    return Math.min(120, Math.round(90 + (if_val - 1.05) / 0.15 * 30));      // 90–120 g/h
  }

  const CARB_RANGES = {
    low:      { min: 30,  max: 45  },
    moderate: { min: 45,  max: 60  },
    high:     { min: 60,  max: 90  },
    extreme:  { min: 90,  max: 120 }
  } as const;

  const FLUID_RANGES = {
    low:      { min: 0.4, max: 0.5 },
    moderate: { min: 0.5, max: 0.7 },
    high:     { min: 0.7, max: 1.0 },
    extreme:  { min: 1.0, max: 1.2 }
  } as const;

  // Per-ride inputs (reset on Reset)
  let distance = 0;
  let durationRaw = ''; // what user types — e.g. "1.30" or "1:30" or "1.5"
  let power = 0;
  let temperature = 20; // °C — no heat bonus below 20°C; resets with ride

  // Parse "1:30", "1.30" (dot = minutes when 2+ digits), or "1.5" → decimal hours
  function parseDuration(raw: string): number {
    const s = raw.trim().replace(',', '.'); // normalize European comma separator
    if (!s) return 0;
    if (s.includes(':')) {
      const [hPart, mPart] = s.split(':');
      const h = parseFloat(hPart) || 0;
      const m = parseFloat(mPart) || 0;
      return Math.max(0, h + m / 60);
    }
    const dot = s.indexOf('.');
    if (dot !== -1) {
      const dec = s.slice(dot + 1);
      if (dec.length >= 2) {
        // "1.30" → 1h 30m
        const h = parseInt(s.slice(0, dot), 10) || 0;
        const m = Math.min(59, parseInt(dec.slice(0, 2), 10) || 0);
        return Math.max(0, h + m / 60);
      }
    }
    return Math.max(0, parseFloat(s) || 0);
  }

  // Display decimal hours as "1:30 h" in badges/labels
  function formatDuration(h: number): string {
    if (h <= 0) return '';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins === 0 ? `${hrs} h` : `${hrs}:${String(mins).padStart(2, '0')} h`;
  }

  $: duration = parseDuration(durationRaw);

  // Rider profile (persists via localStorage — read synchronously so guide renders correctly on first paint)
  let _savedProfile: Record<string, any> = {};
  try { _savedProfile = JSON.parse(localStorage.getItem('bs-profile') || '{}'); } catch { /* ignore */ }
  let weight: number = _savedProfile.weight > 0 ? _savedProfile.weight : 0;
  let ftp: number = _savedProfile.ftp > 0 ? _savedProfile.ftp : 0;
  let imperial: boolean = typeof _savedProfile.imperial === 'boolean' ? _savedProfile.imperial : false;
  let sweatRate: 'light' | 'moderate' | 'heavy' = _savedProfile.sweatRate || 'moderate';

  // UI state
  let showMathSheet = false;
  let profileOpen = false;
  let rideOpen = false;
  let rideAutoCollapsed = false;
  let neuralizer = false;        // easter egg F: neuralyzer flash
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let totalsTab: 'summary' | 'schedule' | 'pack' = 'summary';
  let checkedPack: Set<string> = new Set();
  function togglePack(id: string) {
    if (checkedPack.has(id)) checkedPack.delete(id); else checkedPack.add(id);
    checkedPack = checkedPack;
  }
  function resetPack() { checkedPack.clear(); checkedPack = checkedPack; }
  let showGuide = false;

  const SWEAT_LEVELS = [
    { value: 'light',    drops: 1 },
    { value: 'moderate', drops: 2 },
    { value: 'heavy',    drops: 3 },
  ] as const;

  // Bottle planner
  let bottleSize = 750; // ml

  // Nutrition products
  const SOLID_PRODUCTS = [
    { id: 'gel',   label: 'Gel',   carbs: 22 },
    { id: 'bar',   label: 'Bar',   carbs: 40 },
    { id: 'chew',  label: 'Chew',  carbs: 10 },
  ] as const;
  type SolidId = typeof SOLID_PRODUCTS[number]['id'];

  const DRINK_PRODUCTS = [
    { id: 'water',    label: 'Water only',  carbsPer500: 0  },
    { id: 'mix',      label: 'Carb mix',    carbsPer500: 36 },
    { id: 'isotonic', label: 'Isotonic',    carbsPer500: 30 },
  ] as const;
  type DrinkId = typeof DRINK_PRODUCTS[number]['id'];

  let solidProduct: SolidId = 'gel';
  let drinkProduct: DrinkId = 'water';

  // PWA install bottom sheet (null = hidden)
  let installPlatform: 'ios' | 'android' | null = null;
  let installSheetTimer: ReturnType<typeof setTimeout> | null = null;
  let deferredInstallPrompt: any = null;
  const onBeforeInstallPrompt = (e: Event) => { e.preventDefault(); deferredInstallPrompt = e; };
  const onAppInstalled = () => { installPlatform = null; };
  let sheetDragStartY = 0;
  let sheetDragOffsetY = 0;
  let sheetIsDragging = false;

  function onSheetDragStart(e: TouchEvent) {
    sheetDragStartY = e.touches[0].clientY;
    sheetDragOffsetY = 0;
    sheetIsDragging = true;
  }
  function onSheetDragMove(e: TouchEvent) {
    if (!sheetIsDragging) return;
    e.preventDefault();
    sheetDragOffsetY = Math.max(0, e.touches[0].clientY - sheetDragStartY);
  }
  function onSheetDragEnd() {
    if (!sheetIsDragging) return;
    sheetIsDragging = false;
    if (sheetDragOffsetY > 80) {
      sheetDragOffsetY = window.innerHeight;
      setTimeout(() => {
        if (installPlatform) dismissInstallSheet();
        else if (showRiderCard) showRiderCard = false;
        else if (showChangelogSheet) dismissChangelog();
        else if (showMathSheet) showMathSheet = false;
        sheetDragOffsetY = 0;
      }, 260);
    } else {
      sheetDragOffsetY = 0;
    }
  }

  onMount(() => {
    // Easter egg: console greeting
    console.log(
      '%cBananaSprocket — Cycling Nutrition Planner\n\nPsst. You\'re looking at the source.\nWhy are you not riding your bike?\n\nBuilt by Daniel Muschinski\nhttps://github.com/moindnl',
      'color:#FFD700;background:#111111;font-family:monospace;font-size:12px;padding:16px 20px;border-radius:8px;line-height:1.6;'
    );

    if (localStorage.getItem('bs-seen-build') !== BUILD_NAME) showWhatsNew = true;

    const isMobile = window.innerWidth < 768;
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isMobile && !standalone && (isIos || isAndroid) && !localStorage.getItem('bs-install-dismissed')) {
      installSheetTimer = setTimeout(() => { installPlatform = isIos ? 'ios' : 'android'; }, 1200);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
  });

  onDestroy(() => {
    if (installSheetTimer) clearTimeout(installSheetTimer);
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  function dismissInstallSheet() {
    installPlatform = null;
    sheetDragOffsetY = 0;
    sheetIsDragging = false;
    localStorage.setItem('bs-install-dismissed', '1');
  }
  async function triggerInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome === 'accepted') installPlatform = null;
  }
  // Guard: only save after profile has been loaded from storage
  $: localStorage.setItem('bs-profile', JSON.stringify({ weight, ftp, imperial, sweatRate }));

  // Reset per-ride inputs only; profile persists
  function resetInputs() {
    distance = 0; durationRaw = ''; power = 0; temperature = 20;
    rideOpen = true; rideAutoCollapsed = false;
  }

  // Easter egg F: hold Reset 3s → neuralyzer flash
  function startHold() {
    holdTimer = setTimeout(() => {
      resetInputs();
      neuralizer = true;
      setTimeout(() => { neuralizer = false; }, 2900);
    }, 2000);
  }
  function cancelHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  // Imperial ↔ metric: convert displayed values on toggle
  function toggleImperial() {
    if (!imperial) {
      if (weight > 0)   weight   = Math.round(weight * 2.20462);
      if (distance > 0) distance = Math.round(distance * 0.621371 * 10) / 10;
    } else {
      if (weight > 0)   weight   = Math.round(weight / 2.20462);
      if (distance > 0) distance = Math.round(distance * 1.60934);
    }
    imperial = !imperial;
  }

  // Metric-normalised values used in all calculations
  $: weightKg   = imperial ? weight / 2.20462 : weight;
  $: distanceKm = imperial ? distance * 1.60934 : distance;
  $: speedKmh   = distanceKm > 0 && duration > 0 ? distanceKm / duration : 0;
  $: speedUnit  = imperial ? 'mph' : 'km/h';
  $: heatBonus  = temperature > 20 ? Math.round((temperature - 20) / 5 * 0.3 * 10) / 10 : 0;
  $: sweatMultiplier = sweatRate === 'light' ? 0.8 : sweatRate === 'heavy' ? 1.3 : 1.0;


  // Power-derived zone
  $: intensityFactor = ftp > 0 && power > 0 ? power / ftp : 0;
  $: powerDerived = intensityFactor > 0;

  // 🥚 Easter egg B: Tadej mode at ≥500W
  $: tadejMode = power >= 500;


  $: zoneLabel = intensityFactor === 0 ? '' :
    tadejMode ? 'ARE YOU OKAY?!' :
    intensityFactor < 0.55 ? 'Recovery' :
    intensityFactor < 0.75 ? 'Endurance' :
    intensityFactor < 0.90 ? 'Tempo' :
    intensityFactor < 1.05 ? 'Threshold' :
    'VO₂max+';

  $: zoneBadgeStyle = intensityFactor === 0 ? '' :
    tadejMode
      ? 'background:#f0c000;color:#111111;transition:background 0.35s ease,color 0.35s ease'
      : `background:${
          intensityFactor < 0.55 ? '#4b4b4d' :
          intensityFactor < 0.75 ? '#1151ff' :
          intensityFactor < 0.90 ? '#007d48' :
          intensityFactor < 1.05 ? '#c2410c' : '#d30005'
        };color:#ffffff;transition:background 0.35s ease,color 0.35s ease`;


  $: intensity = (intensityFactor === 0 ? 'moderate' :
    intensityFactor < 0.65 ? 'low' :
    intensityFactor <= 0.80 ? 'moderate' :
    intensityFactor < 0.95 ? 'high' :
    'extreme') as keyof typeof CARB_RANGES;

  // Fluid: weight-scaled + sweat rate + heat adjustment
  $: baseFluid = (FLUID_RANGES[intensity].min + FLUID_RANGES[intensity].max) / 2;
  $: fluidPerHour = weight > 0 && duration > 0 ? baseFluid * (weightKg / 70) * sweatMultiplier + heatBonus : 0;

  // Carbs: IF-based piecewise when power available, zone midpoint fallback
  $: carbsPerHour = duration <= 0 || weight <= 0 ? 0 :
    powerDerived
      ? carbsFromIF(intensityFactor)
      : Math.round((CARB_RANGES[intensity].min + CARB_RANGES[intensity].max) / 2);

  // Energy: kJ mechanical ≈ kcal (cycling standard: 1W × 1h = 3.6 kJ ≈ 3.6 kcal)
  $: kcalPerHour = powerDerived ? Math.round(power * 3.6) : 0;

  // Speed (display unit depends on imperial; animal thresholds always km/h)
  $: speedDisplay = Math.round(imperial ? speedKmh * 0.621371 : speedKmh);

  // Totals
  $: totalCarbs = Math.round(carbsPerHour * duration);
  $: totalFluid = fluidPerHour * duration;
  $: totalKcal  = Math.round(kcalPerHour * duration);

  // Animations
  const TWEEN = { duration: 400, easing: linear };
  const animatedCarbs       = tweened(carbsPerHour, TWEEN);
  const animatedFluid       = tweened(fluidPerHour, TWEEN);
  const animatedSpeed       = tweened(speedDisplay,  TWEEN);
  const animatedTotalCarbs  = tweened(totalCarbs,    TWEEN);
  const animatedTotalFluid  = tweened(totalFluid,    TWEEN);
  const animatedTotalKcal   = tweened(totalKcal,     TWEEN);
  const animatedKcalPerHour = tweened(kcalPerHour,   TWEEN);

  $: animatedCarbs.set(carbsPerHour);
  $: animatedFluid.set(fluidPerHour);
  $: animatedSpeed.set(speedDisplay);
  $: animatedTotalCarbs.set(totalCarbs);
  $: animatedTotalFluid.set(totalFluid);
  $: animatedTotalKcal.set(totalKcal);
  $: animatedKcalPerHour.set(kcalPerHour);

  const animalLinks: Record<string, string> = {
    'Turtle pace':            'https://en.wikipedia.org/wiki/Turtle',
    'Penguin cruise':         'https://en.wikipedia.org/wiki/Penguin',
    'Gazelle pace':           'https://en.wikipedia.org/wiki/Gazelle',
    'Cheetah chase':          'https://en.wikipedia.org/wiki/Cheetah',
    'Falcon flight':          'https://en.wikipedia.org/wiki/Falcon',
    'Peregrine speed':        'https://en.wikipedia.org/wiki/Peregrine_falcon',
    'Greyhound sprint':       'https://en.wikipedia.org/wiki/Greyhound',
    // 🥚 Easter egg E: beyond greyhound
    'Downhill record':    'https://en.wikipedia.org/wiki/%C3%89ric_Barone',
    'Motorcycle territory': 'https://en.wikipedia.org/wiki/Motorcycle',
    'Please call an ambulance': 'https://en.wikipedia.org/wiki/Ambulance',
  };

  $: speedSlogan = speedKmh === 0 ? '' :
    speedKmh < 10 ? 'Turtle pace' :
    speedKmh < 15 ? 'Penguin cruise' :
    speedKmh < 20 ? 'Gazelle pace' :
    speedKmh < 25 ? 'Cheetah chase' :
    speedKmh < 30 ? 'Falcon flight' :
    speedKmh < 40 ? 'Peregrine speed' :
    speedKmh < 55 ? 'Greyhound sprint' :
    speedKmh < 75 ? 'Downhill record' :
    speedKmh < 100 ? 'Motorcycle territory' :
    'Please call an ambulance';

  $: multiCarbNote = intensityFactor >= 0.90;

  // Auto-collapse ride card when focus leaves it and all fields are filled
  function handleRideCardFocusOut(e: FocusEvent) {
    const related = e.relatedTarget as Node | null;
    const card = e.currentTarget as Node;
    if (!card.contains(related) && distance > 0 && duration > 0 && power > 0 && !rideAutoCollapsed) {
      rideOpen = false;
      rideAutoCollapsed = true;
    }
  }

  // Active products
  $: activeSolid = SOLID_PRODUCTS.find(p => p.id === solidProduct)!;
  $: activeDrink = DRINK_PRODUCTS.find(p => p.id === drinkProduct)!;
  $: solidLabel = activeSolid.label.toLowerCase();

  // Bottle planner
  $: bottleCount        = weight > 0 && duration > 0 && totalFluid > 0 ? Math.ceil(totalFluid * 1000 / bottleSize) : 0;
  $: mlPerBottle        = bottleCount > 0 ? Math.round(totalFluid * 1000 / bottleCount) : 0;
  $: drinkCarbsPerHour  = fluidPerHour > 0 ? Math.round(activeDrink.carbsPer500 * (fluidPerHour * 1000 / 500)) : 0;
  $: drinkCarbsPerBottle = bottleCount > 0 ? Math.round(activeDrink.carbsPer500 * mlPerBottle / 500) : 0;

  // Solid food covers carbs not met by drink
  $: solidCarbsPerHour = Math.max(0, carbsPerHour - drinkCarbsPerHour);
  $: carbsPerBottle    = bottleCount > 0 ? Math.round((totalCarbs - drinkCarbsPerHour * duration) / bottleCount) : 0;
  $: totalSolidUnits = duration > 0 && activeSolid.carbs > 0 ? Math.ceil(solidCarbsPerHour * duration / activeSolid.carbs) : 0;

  $: packItems = (() => {
    if (!duration || !weight) return [] as { id: string; label: string }[];
    const items: { id: string; label: string }[] = [];
    if (totalSolidUnits > 0) {
      const withEmergency = duration >= 2;
      const count = withEmergency ? totalSolidUnits + 1 : totalSolidUnits;
      const suffix = withEmergency ? ', +1 emergency' : '';
      items.push({ id: 'fuel', label: `${count} × ${solidLabel} (${activeSolid.carbs}g each${suffix})` });
    }
    if (bottleCount > 0)
      items.push({ id: 'bottles', label: `${bottleCount} × bottle (${bottleSize}ml)` });
    if (drinkProduct !== 'water' && bottleCount > 0)
      items.push({ id: 'carbdrink', label: `${activeDrink.label} mix — ${bottleCount} serving${bottleCount > 1 ? 's' : ''}` });
    if (temperature >= 28)
      items.push({ id: 'electrolytes', label: 'Electrolyte tabs / salt caps' });
    if (duration >= 3)
      items.push({ id: 'cash', label: 'Cash or card (café stop / emergency)' });
    items.push({ id: 'computer', label: 'Bike computer charged' });
    items.push({ id: 'phone', label: 'Phone charged' });
    return items;
  })();
  // Prune checked state for items that no longer exist
  $: {
    const validIds = new Set(packItems.map(i => i.id));
    let pruned = false;
    checkedPack.forEach(id => { if (!validIds.has(id)) { checkedPack.delete(id); pruned = true; } });
    if (pruned) checkedPack = checkedPack;
  }

  // Fueling schedule: 20-min intake slots (solid food only)
  $: fuelingEvents = (() => {
    if (duration <= 0 || weight <= 0) return [] as { time: string; carbs: number; units: number }[];
    const events: { time: string; carbs: number; units: number }[] = [];
    const totalMins = Math.round(duration * 60);
    const carbsPerSlot = Math.round(solidCarbsPerHour / 3);
    const units = carbsPerSlot > 0 ? Math.ceil(carbsPerSlot / activeSolid.carbs) : 0;
    for (let t = 20; t <= totalMins; t += 20) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      events.push({ time: `${h}:${String(m).padStart(2, '0')}`, carbs: carbsPerSlot, units });
    }
    return events;
  })();

  // Scroll input into view after keyboard appears (mobile)
  function focusInput(e: FocusEvent) {
    const el = e.target as HTMLInputElement;
    el.select();
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
  }


  const HOW_TO_STEPS = [
    { n: '1', title: 'Set up your profile', body: 'Enter weight, FTP, and your preferences once — they save automatically.' },
    { n: '2', title: 'Enter your ride', body: 'Add distance, duration, and planned power for this specific ride.' },
    { n: '3', title: 'Read results', body: 'Get precise carbohydrate and fluid targets based on your power output.' },
  ];

  function tabStyle(tab: string, active: string): string {
    return `${active === tab ? 'background:#FFD700;color:#111111;' : 'background:transparent;color:rgba(255,255,255,0.65);'}flex:1;padding:6px 10px;border-radius:18px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;`;
  }
</script>

<main class="min-h-screen bg-[--color-canvas]">

  <!-- Update toast -->
  {#if updateAvailable}
    <div class="fixed top-0 left-0 right-0 z-[1000] flex justify-center pt-3 px-4 pointer-events-none"
      transition:fly={{ y: -48, duration: 300, easing: cubicOut }}>
      <div class="inline-flex items-center gap-md rounded-full px-md py-sm pointer-events-auto"
        style="background:#111111;color:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.25);">
        <RefreshCw class="w-3.5 h-3.5 flex-shrink-0" style="color:#FFD700;" />
        <span class="text-caption-sm" style="color:rgba(255,255,255,0.85);">Update available</span>
        <button on:click={() => doUpdateSW()}
          class="text-caption-sm font-extra-bold rounded-full px-sm py-xxs"
          style="background:#FFD700;color:#111111;">Refresh</button>
        <button on:click={() => updateAvailable = false} aria-label="Dismiss">
          <X class="w-3.5 h-3.5" style="color:rgba(255,255,255,0.45);" />
        </button>
      </div>
    </div>
  {/if}

  <!-- App Header -->
  <header class="w-full py-xl text-center rounded-b-[28px]" style="background:var(--color-soft-cloud);">
    <div class="flex items-center justify-center mb-sm">
      <h1 class="text-heading-xl md:text-display-campaign font-extra-bold flex items-center gap-sm md:gap-md" style="color:var(--color-ink);">
        Banana
        <img src="/favicon.svg" alt=""
          class="w-9 h-9 md:w-[86px] md:h-[86px] flex-shrink-0"
          style="border-radius:18%;box-shadow:0 0 0 1px rgba(180,100,0,0.25),0 0 10px rgba(180,100,0,0.12);" />
        Sprocket
      </h1>
    </div>
    <p class="text-caption-md mb-sm" style="color:var(--color-mute);">Precise carb &amp; fluid targets from your FTP and power.</p>
    <div class="flex items-center justify-center gap-md flex-wrap">
      {#if weight > 0 || ftp > 0}
        <button class="inline-flex items-center gap-xs text-caption-sm text-[--color-stone] underline underline-offset-[3px]"
          on:click={() => (showGuide = !showGuide)}>
          {#if showGuide}
            <X class="w-3.5 h-3.5" />Hide guide
          {:else}
            <Info class="w-3.5 h-3.5" />Guide
          {/if}
        </button>
      {/if}
      {#if showWhatsNew}
        <button class="inline-flex items-center gap-xs text-caption-sm text-[--color-stone] underline underline-offset-[3px]"
          on:click={() => (showChangelogSheet = true)}>
          v{VERSION} · {BUILD_NAME} <ChevronRight class="w-3 h-3" />
        </button>
      {/if}
    </div>
  </header>

  <div class="max-w-6xl mx-auto p-sm md:p-md lg:p-lg">

    <!-- 3-step how-to — shown on first visit or on demand -->
    {#if !(weight > 0 || ftp > 0) || showGuide}
    <div transition:fade={{ duration: 200 }} class="mb-lg md:mb-section card-enter card-enter-1">
      <!-- Mobile: horizontal swipe cards -->
      <div class="flex md:hidden overflow-x-auto snap-x snap-mandatory gap-sm pb-sm -mx-sm px-sm" style="scrollbar-width:none;-webkit-overflow-scrolling:touch;">
        {#each HOW_TO_STEPS as step, i}
          <div class="snap-center shrink-0 w-[78%] card-soft rounded-sm overflow-hidden shimmer-once flex"
            style="--shimmer-delay:{0.5 + i * 0.1}s"
            in:fly={{ y: 18, duration: 320, delay: 80 + i * 70, easing: cubicOut }}>
            <div class="flex items-center justify-center flex-shrink-0" style="background:#FFD700;min-width:56px;padding:0 18px 0 14px;clip-path:polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);">
              <span class="text-lg font-bold" style="color:#111111;">{step.n}</span>
            </div>
            <div class="p-lg space-y-xs">
              <h2 class="text-body-strong font-bold text-[--color-ink]">{step.title}</h2>
              <p class="text-caption-md text-[--color-charcoal]">{step.body}</p>
            </div>
          </div>
        {/each}
      </div>
      <!-- Desktop: 3-column grid -->
      <div class="hidden md:grid grid-cols-3 gap-lg card-soft rounded-sm overflow-hidden">
        {#each HOW_TO_STEPS as step, i}
          <div class="flex flex-col"
            in:fly={{ y: 18, duration: 320, delay: 80 + i * 70, easing: cubicOut }}>
            <div class="flex items-center justify-center py-md" style="background:#FFD700;">
              <span class="text-lg font-bold" style="color:#111111;">{step.n}</span>
            </div>
            <div class="p-lg space-y-xs flex-1">
              <h2 class="text-body-strong font-bold text-[--color-ink]">{step.title}</h2>
              <p class="text-caption-md text-[--color-charcoal]">{step.body}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
    {/if}

    <!-- Input section -->
    <div class="mb-lg card-enter card-enter-2">
      <div class="flex items-center gap-md mb-lg">
        <div class="flex-1 h-px" style="background:var(--color-hairline);"></div>
        <span class="badge text-utility-xs font-bold uppercase tracking-widest">Setup</span>
        <div class="flex-1 h-px" style="background:var(--color-hairline);"></div>
      </div>

    <!-- Unified setup card -->
    <div class="rounded-sm overflow-hidden mb-lg"
      style="background:var(--color-canvas);border:1px solid var(--color-hairline);">

    <!-- Rider Profile -->
    <div>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer"
        on:click={() => { profileOpen = !profileOpen; if (profileOpen) rideOpen = false; }}
        aria-expanded={profileOpen}
      >
        <div class="flex flex-wrap items-center gap-sm min-w-0">
          <div class="flex items-center gap-sm flex-shrink-0">
            <User class="w-5 h-5 text-[--color-ink]" />
            <span class="text-heading-md font-bold text-[--color-ink]">Rider Profile</span>
          </div>
          {#if !profileOpen}
            {#if weight > 0 && ftp > 0}
              <CheckCircle class="w-5 h-5 text-[--color-success]" />
            {:else if weight > 0 || ftp > 0}
              <span class="inline-flex items-center gap-xxs text-caption-sm text-[--color-mute]">Almost done <ChevronRight class="w-3 h-3" /></span>
            {:else}
              <span class="inline-flex items-center gap-xxs text-caption-sm text-[--color-sale]">Set up profile <ChevronRight class="w-3 h-3" /></span>
            {/if}
          {/if}
        </div>
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-sm" style="background:var(--color-hairline-soft);">
          <ChevronDown class="w-4 h-4 text-[--color-ink] transition-transform duration-200 {profileOpen ? 'rotate-180' : ''}" />
        </div>
      </button>

      {#if profileOpen}
        <div transition:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;">
          <div class="bg-[--color-soft-cloud] rounded-sm overflow-hidden">

            <!-- Weight -->
            <div class="flex items-center justify-between px-lg py-lg">
              <div class="flex items-center gap-sm">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Scale class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <label for="weight" class="text-caption-md text-[--color-ink]">Body Weight</label>
              </div>
              <div class="flex items-center gap-xs">
                <input id="weight" type="number" bind:value={weight} min="1" max="400" step="1" placeholder="75"
                  class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                  style="height:36px;border-radius:20px;border:1px solid #cacacb;padding:0 12px;background:#fff;"
                  on:focus={focusInput} />
                <span class="text-caption-sm text-[--color-mute] w-5">{imperial ? 'lbs' : 'kg'}</span>
              </div>
            </div>

            <!-- FTP -->
            <div class="flex items-center justify-between px-lg py-lg">
              <div class="flex items-center gap-sm">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Zap class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <div>
                  <label for="ftp" class="text-caption-md text-[--color-ink] block">FTP</label>
                  <span class="text-caption-sm text-[--color-mute]">Max 1-hour power</span>
                </div>
              </div>
              <div class="flex items-center gap-xs">
                <input id="ftp" type="number" bind:value={ftp} min="0" max="600" step="1" placeholder="280"
                  class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                  style="height:36px;border-radius:20px;border:1px solid #cacacb;padding:0 12px;background:#fff;"
                  on:focus={focusInput} />
                <span class="text-caption-sm text-[--color-mute] w-5">W</span>
              </div>
            </div>

            <!-- Units — segmented control -->
            <div class="flex items-center justify-between px-lg py-lg gap-md flex-wrap">
              <div class="flex items-center gap-sm">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Ruler class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <span class="text-caption-md text-[--color-ink]">Units</span>
              </div>
              <div style="display:flex;border-radius:20px;border:1px solid #cacacb;overflow:hidden;background:#f5f5f5;">
                <button
                  style="{!imperial ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                  on:click={() => { if (imperial) toggleImperial(); }}>km / kg</button>
                <button
                  style="{imperial ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                  on:click={() => { if (!imperial) toggleImperial(); }}>mi / lbs</button>
              </div>
            </div>

            <!-- Sweat Rate — segmented control -->
            <div class="flex items-center justify-between px-lg py-lg gap-md">
              <div class="flex items-center gap-sm flex-shrink-0">
                <div class="w-7 h-7 rounded-full bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
                  <Droplet class="w-4 h-4 text-[--color-charcoal]" />
                </div>
                <div>
                  <span class="text-caption-md text-[--color-ink] block">Sweat Rate</span>
                  <span class="text-caption-sm text-[--color-mute]">
                    {sweatRate === 'light' ? '−20% fluid' : sweatRate === 'heavy' ? '+30% fluid' : 'Baseline'}
                  </span>
                </div>
              </div>
              <div style="display:flex;border-radius:20px;border:1px solid #cacacb;overflow:hidden;background:#f5f5f5;flex-shrink:0;">
                {#each SWEAT_LEVELS as { value, drops }}
                  <button
                    class="flex items-center gap-[2px]"
                    style="{sweatRate === value ? 'background:#111111;color:#ffffff;' : 'background:transparent;color:#707072;'}padding:7px 16px;transition:background 0.15s,color 0.15s;"
                    on:click={() => (sweatRate = value)}>
                    {#each { length: drops } as _}<Droplet class="w-3.5 h-3.5" />{/each}
                  </button>
                {/each}
              </div>
            </div>

          </div>
          <div class="flex items-center gap-xs px-lg pt-xl pb-lg">
            <Lock class="w-3 h-3 text-[--color-stone] flex-shrink-0" />
            <p class="text-caption-sm text-[--color-stone]">Saved locally on this device. Nothing sent to any server.</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Internal divider -->
    <div class="h-px" style="background:var(--color-hairline);"></div>

    <!-- Ride Input -->
    <div>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer"
        on:click={() => { rideOpen = !rideOpen; if (rideOpen) profileOpen = false; }}
        aria-expanded={rideOpen}
      >
        <div class="flex flex-wrap items-center gap-sm min-w-0">
          <div class="flex items-center gap-sm flex-shrink-0">
            <Bike class="w-5 h-5 text-[--color-ink]" />
            <span class="text-heading-md font-bold text-[--color-ink]">Ride</span>
          </div>
          {#if !rideOpen}
            {#if power > 0 && duration > 0}
              <div class="flex flex-wrap items-center gap-xs">
                <CheckCircle class="w-5 h-5 text-[--color-success]" />
                {#if distance > 0}<span class="badge">{distance} {imperial ? 'mi' : 'km'}</span>{/if}
                <span class="badge">{formatDuration(duration)}</span>
                <span class="badge">{power} W</span>
                {#if temperature !== 20}<span class="badge">{temperature}°C</span>{/if}
              </div>
            {:else if distance > 0 || duration > 0 || power > 0}
              <span class="inline-flex items-center gap-xxs text-caption-sm text-[--color-mute]">Almost done <ChevronRight class="w-3 h-3" /></span>
            {:else}
              <span class="inline-flex items-center gap-xxs text-caption-sm text-[--color-sale]">Add ride details <ChevronRight class="w-3 h-3" /></span>
            {/if}
          {/if}
        </div>
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-sm" style="background:var(--color-hairline-soft);">
          <ChevronDown class="w-4 h-4 text-[--color-ink] transition-transform duration-200 {rideOpen ? 'rotate-180' : ''}" />
        </div>
      </button>

      {#if rideOpen}
        <div transition:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;">
          <div class="bg-[--color-soft-cloud] rounded-sm overflow-hidden"
            on:focusout={handleRideCardFocusOut}>

            <!-- Row 1: Distance / Duration -->
            <div class="grid grid-cols-1 md:grid-cols-2">
              <div class="flex items-center justify-between px-lg py-lg md:border-r border-[var(--color-hairline)]">
                <label for="distance" class="text-caption-md text-[--color-ink]">Distance</label>
                <div class="flex items-center gap-xs">
                  <input id="distance" type="number" bind:value={distance} min="1" max="500" step="1"
                    class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                    style="height:36px;border-radius:20px;border:1px solid #cacacb;padding:0 12px;background:#fff;"
                    on:focus={focusInput} />
                  <span class="text-caption-sm text-[--color-mute] w-5">{imperial ? 'mi' : 'km'}</span>
                </div>
              </div>
              <div class="flex items-center justify-between px-lg py-lg">
                <div>
                  <label for="duration" class="text-caption-md text-[--color-ink]">Duration</label>
                  <p class="text-utility-xs text-[--color-stone] mt-xxs">e.g. 1:30 or 1.5 for 1h 30min</p>
                </div>
                <div class="flex items-center gap-xs">
                  <input id="duration" type="text" inputmode="decimal" bind:value={durationRaw}
                    placeholder="1:30"
                    class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                    style="height:36px;border-radius:20px;border:1px solid #cacacb;padding:0 12px;background:#fff;"
                    on:focus={focusInput} />
                  <span class="text-caption-sm text-[--color-mute] w-5">h</span>
                </div>
              </div>
            </div>

            <!-- Row 2: Power / Zone -->
            <div class="grid grid-cols-1 md:grid-cols-2">
              <div class="flex items-center justify-between px-lg py-lg md:border-r border-[var(--color-hairline)]">
                <div>
                  <label for="power" class="text-caption-md text-[--color-ink] block">Ride Power</label>
                  <span class="text-caption-sm text-[--color-mute]">Planned average</span>
                </div>
                <div class="flex items-center gap-xs">
                  <input id="power" type="number" bind:value={power} min="0" max="600" step="1"
                    class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                    style="height:36px;border-radius:20px;border:1px solid #cacacb;padding:0 12px;background:#fff;"
                    on:focus={focusInput} />
                  <span class="text-caption-sm text-[--color-mute] w-5">W</span>
                </div>
              </div>
              <div class="flex items-center justify-between px-lg py-lg">
                <span class="text-caption-md text-[--color-ink]">Zone</span>
                <div class="flex items-center h-10">
                  {#if powerDerived && zoneLabel}
                    <span class="badge-black" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}%</span>
                  {:else if ftp === 0}
                    <span class="text-[--color-mute] text-caption-sm">Enter FTP first</span>
                  {:else}
                    <span class="text-[--color-mute] text-caption-sm">Enter power</span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Temperature -->
            <div class="px-lg py-lg">
              <div class="flex items-center justify-between mb-sm">
                <label for="temperature" class="text-caption-md text-[--color-ink]">Temperature</label>
                <span class="text-caption-md font-bold text-[--color-ink]">{temperature}°C</span>
              </div>
              <input id="temperature" type="range" bind:value={temperature} min="0" max="45" step="1"
                class="temp-slider w-full"
                style="--fill:{(temperature / 45 * 100).toFixed(1)}%" />
              <p class="text-caption-sm mt-md {heatBonus > 0 ? 'text-[--color-sale]' : 'text-[--color-mute]'}">
                {heatBonus > 0 ? `+${heatBonus.toFixed(1)} L/h heat adjustment` : 'Heat adjustment activates above 20°C'}
              </p>
            </div>

            <!-- Reset -->
            <div class="flex justify-end px-lg py-md">
              <button class="filter-chip flex items-center gap-xs" on:click={resetInputs}
                on:mousedown={startHold} on:mouseup={cancelHold} on:mouseleave={cancelHold}
                on:touchstart|preventDefault={startHold} on:touchend={cancelHold} on:touchcancel={cancelHold}
                on:contextmenu|preventDefault
                style="touch-action:manipulation;user-select:none;-webkit-user-select:none;"
                aria-label="Reset ride inputs">
                <RotateCcw class="w-4 h-4" />
                Reset ride
              </button>
            </div>

          </div>
        </div>
      {/if}
    </div>

    </div><!-- /Unified setup card -->

    </div><!-- /Input section -->

    <!-- Results divider -->
    <div class="flex items-center gap-md mb-lg card-enter card-enter-4">
      <div class="flex-1 h-px" style="background:var(--color-hairline);"></div>
      <span class="badge text-utility-xs font-bold uppercase tracking-widest">Results</span>
      <div class="flex-1 h-px" style="background:var(--color-hairline);"></div>
    </div>

    <!-- Results Row 1: Speed + Power -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg mb-lg card-enter card-enter-4">

      <!-- Speed card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
            <Gauge class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Speed</h2>
            <p class="text-caption-sm text-[--color-mute]">Average pace for your ride</p>
          </div>
        </div>
        <div class="mb-lg">
          <div class="flex items-baseline gap-sm">
            <span class="text-7xl md:text-8xl font-extra-bold" style="color:{speedKmh > 0 ? 'var(--color-ink)' : 'var(--color-hairline)'};transition:color 0.3s ease;">{Math.round($animatedSpeed)}</span>
            <span class="text-3xl text-[--color-mute]">{speedUnit}</span>
          </div>
        </div>
        {#if speedSlogan}
          <a href={animalLinks[speedSlogan]} target="_blank" rel="noopener noreferrer">
            <span class="badge-black inline-flex items-center gap-xs">
              {speedSlogan}
              <ExternalLink class="w-3 h-3" />
            </span>
          </a>
        {/if}
      </div>

      <!-- Power card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
            <Zap class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Power</h2>
            <p class="text-caption-sm text-[--color-mute]">Ride intensity based on your FTP</p>
          </div>
        </div>
        <div class="mb-md">
          <div class="flex items-baseline gap-sm">
            <span class="text-7xl md:text-8xl font-extra-bold" style="color:{power > 0 ? 'var(--color-ink)' : 'var(--color-hairline)'};transition:color 0.3s ease;">{power}</span>
            <span class="text-3xl text-[--color-mute]">W</span>
          </div>
        </div>
        {#if powerDerived}
          <div class="flex items-center gap-sm flex-wrap">
            <span class="badge-black" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}% FTP</span>
            <span class="badge-black" style="background:#c2410c;color:#ffffff;">~{Math.round($animatedKcalPerHour)} kcal/h</span>
          </div>
        {:else}
          <p class="text-caption-sm text-[--color-mute]">Enter FTP in Rider Profile & ride power above</p>
        {/if}
      </div>
    </div>

    <!-- Results Row 2: Carbs + Fluids -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg mb-lg card-enter card-enter-5">

      <!-- Carbs card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
            <Wheat class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Carbohydrates</h2>
            <p class="text-caption-sm text-[--color-mute]">Per hour for optimal performance</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key carbsPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold {carbsPerHour > 0 ? 'num-flash' : ''}" style="color:{carbsPerHour > 0 ? 'var(--color-ink)' : 'var(--color-hairline)'};transition:color 0.3s ease;">{Math.round($animatedCarbs)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">g/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">
          {#if powerDerived}
            From {power}W at {Math.round(intensityFactor * 100)}% FTP
          {:else}
            Estimated from intensity level
          {/if}
        </p>
        {#if multiCarbNote}
          <p class="text-caption-sm text-[--color-mute] mt-sm">Requires glucose+fructose blend (2:1). Single carbs max ~60 g/h.</p>
        {/if}
      </div>

      <!-- Fluids card -->
      <div class="card p-lg">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 rounded-sm bg-[--color-soft-cloud] flex items-center justify-center flex-shrink-0">
            <Droplet class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Fluids</h2>
            <p class="text-caption-sm text-[--color-mute]">Per hour for hydration</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key fluidPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold {fluidPerHour > 0 ? 'num-flash' : ''}" style="color:{fluidPerHour > 0 ? 'var(--color-ink)' : 'var(--color-hairline)'};transition:color 0.3s ease;">{$animatedFluid.toFixed(1)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">L/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">Based on weight, sweat rate, and duration</p>
        {#if sweatRate !== 'moderate'}
          <p class="text-caption-sm text-[--color-mute] mt-xs">{sweatRate === 'light' ? '−20%' : '+30%'} for {sweatRate} sweater</p>
        {/if}
        {#if heatBonus > 0}
          <p class="text-caption-sm text-[--color-sale] mt-xs">+{heatBonus.toFixed(1)} L/h for {temperature}°C heat</p>
        {/if}
      </div>
    </div>

    <!-- Totals + Fueling Schedule + Bottle Planner — tabbed dark card -->
    <div class="card-campaign rounded-sm p-lg md:p-xl mb-xl card-enter card-enter-6">

      <!-- Tab bar -->
      <div style="display:flex;gap:3px;margin-bottom:18px;background:rgba(255,255,255,0.08);border-radius:20px;padding:3px;">
        <button
          style={tabStyle('summary', totalsTab)}
          on:click={() => (totalsTab = 'summary')}>Summary</button>
        <button
          style={tabStyle('schedule', totalsTab)}
          on:click={() => (totalsTab = 'schedule')}>Schedule</button>
        <button
          style={tabStyle('pack', totalsTab)}
          on:click={() => (totalsTab = 'pack')}>Pack</button>
      </div>

      <!-- Summary tab -->
      {#if totalsTab === 'summary'}
        <div in:fade={{ duration: 250 }}>
        <h2 class="text-caption-md mb-lg text-[--color-on-primary]">Total needs for {duration > 0 ? formatDuration(duration) : '—'}</h2>
        <div class="grid grid-cols-3 gap-md">
          <div class="bg-[--color-on-primary] rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold text-[--color-ink] mb-xs">{Math.round($animatedTotalCarbs)}g</div>
            <div class="text-caption-sm text-[--color-charcoal]">Carbs</div>
          </div>
          <div class="bg-[--color-on-primary] rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold text-[--color-ink] mb-xs flex items-center justify-center" style="min-height:1.2em;">
              {powerDerived ? Math.round($animatedTotalKcal) : '—'}
            </div>
            <div class="text-caption-sm text-[--color-charcoal]">kcal</div>
          </div>
          <div class="bg-[--color-on-primary] rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold text-[--color-info] mb-xs">{$animatedTotalFluid.toFixed(1)}L</div>
            <div class="text-caption-sm text-[--color-charcoal]">Fluids</div>
          </div>
        </div>
        </div>

      <!-- Schedule tab -->
      {:else if totalsTab === 'schedule'}
        <div in:fade={{ duration: 250 }}>
        <!-- Solid product picker -->
        <div class="flex items-center justify-between mb-md flex-wrap gap-sm">
          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Solid food</span>
          <div style="display:flex;border-radius:20px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;background:rgba(255,255,255,0.06);">
            {#each SOLID_PRODUCTS as p}
              <button
                style="{solidProduct === p.id ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;"
                on:click={() => (solidProduct = p.id)}>{p.label} ({p.carbs}g)</button>
            {/each}
          </div>
        </div>
        {#if fuelingEvents.length === 0}
          <p style="color:rgba(255,255,255,0.5);font-size:14px;">Enter weight and duration to generate schedule.</p>
        {:else if fuelingEvents[0].carbs === 0}
          <p style="color:rgba(255,255,255,0.5);font-size:14px;">No solid food needed — drink covers all carbs.</p>
        {:else}
          <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">
            {#each fuelingEvents as event, i}
              <div class="flex items-center justify-between px-lg py-md"
                style="{i < fuelingEvents.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.08);' : ''}">
                <span style="color:rgba(255,255,255,0.5);font-size:13px;font-variant-numeric:tabular-nums;min-width:2.6rem;">{event.time}</span>
                <span style="color:#ffffff;font-weight:700;font-size:15px;">{event.carbs}g</span>
                <span style="color:rgba(255,255,255,0.5);font-size:12px;">{event.units}× {solidLabel}</span>
              </div>
            {/each}
          </div>
          <div class="flex items-center justify-between mt-md">
            <p style="color:rgba(255,255,255,0.45);font-size:12px;">First fuel at 20 min · every 20 min after</p>
            <p style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;">{totalSolidUnits} {solidLabel}s total</p>
          </div>
          {#if drinkCarbsPerHour > 0}
            <p style="color:rgba(255,255,255,0.45);font-size:11px;margin-top:6px;">↑ reduced by {drinkCarbsPerHour}g/h from drink</p>
          {/if}
        {/if}

        </div>

      <!-- Pack tab (bottles + checklist) -->
      {:else if totalsTab === 'pack'}
        <div in:fade={{ duration: 250 }}>
        {#if bottleCount === 0}
          <p style="color:rgba(255,255,255,0.5);font-size:14px;">Enter weight and duration to plan bottles.</p>
        {:else}
          <!-- Drink product picker -->
          <div class="flex items-center justify-between mb-md flex-wrap gap-sm">
            <span style="color:rgba(255,255,255,0.7);font-size:13px;">Drink type</span>
            <div style="display:flex;border-radius:20px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;background:rgba(255,255,255,0.06);">
              {#each DRINK_PRODUCTS as p}
                <button
                  style="{drinkProduct === p.id ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 12px;font-size:12px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                  on:click={() => (drinkProduct = p.id)}>{p.label}</button>
              {/each}
            </div>
          </div>
          <!-- Bottle size selector -->
          <div class="flex items-center justify-between mb-lg flex-wrap gap-sm">
            <span style="color:rgba(255,255,255,0.7);font-size:13px;">Bottle size</span>
            <div style="display:flex;border-radius:20px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;background:rgba(255,255,255,0.06);">
              <button style="{bottleSize === 500 ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;" on:click={() => (bottleSize = 500)}>500ml</button>
              <button style="{bottleSize === 750 ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;" on:click={() => (bottleSize = 750)}>750ml</button>
              <button style="{bottleSize === 1000 ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;" on:click={() => (bottleSize = 1000)}>1L</button>
            </div>
          </div>
          <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">
            <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">Bottles needed</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{bottleCount}</span>
            </div>
            <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">Fluid per bottle</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{mlPerBottle} ml</span>
            </div>
            {#if drinkCarbsPerBottle > 0}
              <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.08);">
                <span style="color:rgba(255,255,255,0.6);font-size:14px;">Carbs from drink</span>
                <span style="color:#fff;font-weight:700;font-size:15px;">{drinkCarbsPerBottle} g/bottle</span>
              </div>
            {/if}
            <div class="flex items-center justify-between px-lg py-md">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">Extra solid carbs</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{Math.max(0, carbsPerBottle)} g/bottle</span>
            </div>
          </div>
          {#if drinkCarbsPerHour > 0}
            <p style="color:rgba(255,255,255,0.45);font-size:11px;margin-top:10px;">Drink covers {drinkCarbsPerHour}g/h → less solid food needed. Check Schedule tab.</p>
          {:else}
            <p style="color:rgba(255,255,255,0.45);font-size:12px;margin-top:10px;">Water only — all carbs from solid food.</p>
          {/if}

          <!-- Pack checklist -->
          {#if packItems.length > 0}
            <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
              <div class="flex items-center justify-between mb-md">
                <span style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Pack list</span>
                {#if checkedPack.size > 0}
                  <button style="color:rgba(255,255,255,0.5);font-size:11px;" on:click={resetPack}>Reset</button>
                {/if}
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                {#each packItems as item}
                  {@const checked = checkedPack.has(item.id)}
                  <button
                    class="flex items-center gap-md text-left"
                    on:click={() => togglePack(item.id)}>
                    <div style="width:22px;height:22px;border-radius:6px;border:1.5px solid {checked ? '#FFD700' : 'rgba(255,255,255,0.25)'};background:{checked ? '#FFD700' : 'transparent'};flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;">
                      {#if checked}
                        <Check class="w-3 h-3" style="color:#111111;" />
                      {/if}
                    </div>
                    <span style="font-size:14px;color:{checked ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)'};text-decoration:{checked ? 'line-through' : 'none'};transition:color 0.15s;">{item.label}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="text-center -mx-sm md:-mx-md lg:-mx-lg px-sm md:px-md lg:px-lg" style="background:var(--color-soft-cloud);padding-bottom:max(56px, calc(env(safe-area-inset-bottom) + 32px));padding-top:1.5rem;">
      <div class="flex items-center justify-center gap-xs mb-lg">
        <span class="text-caption-sm text-[--color-stone]" style="font-weight:600;">Banana</span>
        <img src="/favicon.svg" alt=""
          class="w-5 h-5 flex-shrink-0"
          style="border-radius:18%;box-shadow:0 0 0 1px rgba(180,100,0,0.25),0 0 6px rgba(180,100,0,0.12);" />
        <span class="text-caption-sm text-[--color-stone]" style="font-weight:600;">Sprocket</span>
      </div>
      <div class="flex justify-center items-center gap-md">
        <button on:click={() => showMathSheet = true}
          class="text-caption-sm text-[--color-mute]"
          style="padding:6px 16px;border-radius:9999px;border:1px solid var(--color-hairline);transition:background 0.2s ease;">How the math works</button>
        <button on:click={() => showRiderCard = true}
          class="text-caption-sm text-[--color-mute]"
          style="padding:6px 16px;border-radius:9999px;border:1px solid var(--color-hairline);transition:background 0.2s ease;">v{VERSION} · {BUILD_NAME}</button>
      </div>
    </div>

  </div>

  <!-- Rider card -->
  {#if showRiderCard && currentRider}
    <div class="fixed inset-0 z-[995] bg-black/40" style="backdrop-filter:blur(2px);"
      on:click={() => showRiderCard = false} role="presentation"
      transition:fade={{ duration: 200 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[996] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto text-center"
      style="background:rgba(17,17,17,0.93);color:#ffffff;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={onSheetDragStart}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      transition:fly={{ duration: 300, y: 80 }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:rgba(255,255,255,0.25);"></div>
      <p class="text-heading-md font-extra-bold mb-xs" style="color:#ffffff;">{BUILD_NAME}</p>
      <span style="display:inline-block;background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);padding:4px 14px;border-radius:9999px;font-size:13px;font-weight:500;">{currentRider.specialty}</span>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px;">
        {#each currentRider.wins as win}
          <span style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:5px;"><Trophy size={11} />{win}</span>
        {/each}
      </div>
      <p class="text-body-md mt-lg" style="color:rgba(255,255,255,0.75);">{currentRider.bio}</p>
      <div class="mt-lg flex gap-sm">
        <a href="https://www.procyclingstats.com/rider/{PCS_SLUG}" target="_blank" rel="noopener noreferrer"
          class="flex-1 py-3 rounded-full text-button-md font-extra-bold text-center"
          style="background:#FFD700;color:#111111;text-decoration:none;">
          PCS profile <ExternalLink size={14} style="display:inline;vertical-align:middle;margin-left:4px;" />
        </a>
        <button on:click={() => showRiderCard = false}
          class="flex-1 py-3 rounded-full text-button-md font-extra-bold"
          style="background:rgba(255,255,255,0.12);color:#ffffff;">
          Close
        </button>
      </div>
    </div>
  {/if}

  <!-- Changelog sheet -->
  {#if showChangelogSheet}
    <div class="fixed inset-0 z-[990] bg-black/40" style="backdrop-filter:blur(2px);"
      on:click={dismissChangelog} role="presentation" transition:fade={{ duration: 200 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[991] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto"
      style="background:rgba(17,17,17,0.93);color:#ffffff;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={onSheetDragStart}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      transition:fly={{ duration: 300, y: 80 }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:rgba(255,255,255,0.25);"></div>
      <p class="text-heading-md font-extra-bold mb-xs" style="color:#ffffff;">What's new</p>
      <p class="text-caption-md mb-lg" style="color:rgba(255,255,255,0.5);">v{VERSION} · {BUILD_NAME}</p>
      <ul style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
        {#each CHANGELOG_ITEMS as item}
          <li class="flex items-start gap-md">
            <span style="color:#FFD700;font-size:16px;line-height:1.4;flex-shrink:0;">·</span>
            <span style="font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5;">{item}</span>
          </li>
        {/each}
      </ul>
      <button on:click={dismissChangelog}
        class="w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:#FFD700;color:#111111;">
        Got it
      </button>
    </div>
  {/if}

  <!-- PWA install bottom sheet -->
  {#if installPlatform}
    <div class="fixed inset-0 z-[990] bg-black/40" style="backdrop-filter:blur(2px);"
      on:click={dismissInstallSheet} role="presentation" transition:fade={{ duration: 200 }}>
    </div>
    <div class="fixed bottom-0 left-0 right-0 z-[991] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto"
      style="background:rgba(17,17,17,0.93);color:#ffffff;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={onSheetDragStart}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      transition:fly={{ duration: 300, y: 80 }}>
      <!-- Drag handle -->
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:rgba(255,255,255,0.25);"></div>

      <div class="mb-4">
        <p class="text-heading-md font-extra-bold" style="color:#ffffff;">Works offline</p>
        <p class="text-caption-md mt-1" style="color:rgba(255,255,255,0.6);">Save to home screen for instant access.</p>
      </div>

      {#if installPlatform === 'ios'}
        <ol class="space-y-3 text-body-md">
          <li class="flex items-start gap-3">
            <span class="badge-black text-xs shrink-0 mt-0.5" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">1</span>
            <span>Tap the <strong>Share</strong> button at the bottom of Safari</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge-black text-xs shrink-0 mt-0.5" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">2</span>
            <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge-black text-xs shrink-0 mt-0.5" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">3</span>
            <span>Tap <strong>Add</strong> — done</span>
          </li>
        </ol>
        <p class="text-caption-sm mt-4" style="color:rgba(255,255,255,0.5);">Safari only. Chrome and Firefox on iOS cannot install PWAs.</p>
      {:else}
        {#if deferredInstallPrompt}
          <button on:click={triggerInstall}
            class="w-full py-3 rounded-full text-button-md font-extra-bold mb-4"
            style="background:#FFD700;color:#111111;">
            Install now
          </button>
        {:else}
          <ol class="space-y-3 text-body-md">
            <li class="flex items-start gap-3">
              <span class="badge-black text-xs shrink-0 mt-0.5" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">1</span>
              <span>Tap the <strong>⋮ menu</strong> in Chrome <span style="color:rgba(255,255,255,0.5);">(top-right corner)</span></span>
            </li>
            <li class="flex items-start gap-3">
              <span class="badge-black text-xs shrink-0 mt-0.5" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">2</span>
              <span>Tap <strong>Add to Home screen</strong> → <strong>Add</strong></span>
            </li>
          </ol>
          <p class="text-caption-sm mt-4" style="color:rgba(255,255,255,0.5);">Chrome may also show an install banner at the bottom automatically.</p>
        {/if}
      {/if}

      <button on:click={dismissInstallSheet}
        class="mt-6 w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:rgba(255,255,255,0.12);color:#ffffff;">
        Not now
      </button>
    </div>
  {/if}

  <!-- Easter egg F: neuralyzer flash -->
  {#if neuralizer}
    <div class="fixed inset-0 z-[999] flex flex-col items-center justify-center"
      style="background:rgba(0,0,0,0.88);animation:neuralizer-flash 2.9s ease forwards;">
      <p style="font-size:clamp(14px,3vw,18px);font-weight:700;color:#ffffff;text-align:center;max-width:420px;padding:0 24px;line-height:1.6;opacity:0;animation:neuralizer-text 2.9s ease forwards;">
        Hm? There was no ride. You've been watching Netflix. Have a nice day.
      </p>
    </div>
  {/if}

  <!-- Math sheet -->
  {#if showMathSheet}
    <div class="fixed inset-0 z-[990] bg-black/40" style="backdrop-filter:blur(2px);"
      on:click={() => showMathSheet = false} role="presentation"
      transition:fade={{ duration: 200 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[991] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto"
      style="background:rgba(17,17,17,0.93);color:#ffffff;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={onSheetDragStart}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      transition:fly={{ duration: 300, y: 80 }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:rgba(255,255,255,0.25);"></div>
      <p class="text-heading-md font-extra-bold mb-lg" style="color:#ffffff;">How the math works</p>

      <div class="mb-lg" style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
        <div class="grid text-caption-sm font-extra-bold uppercase" style="grid-template-columns:1fr auto auto;background:rgba(255,255,255,0.08);padding:8px 14px;color:rgba(255,255,255,0.45);letter-spacing:0.05em;">
          <span>Zone</span><span class="text-right pr-4">% FTP</span><span class="text-right">Carbs</span>
        </div>
        {#each [
          { zone: 'Recovery',  ftp: '<55%',    carbs: '0–20 g/h' },
          { zone: 'Endurance', ftp: '55–75%',  carbs: '20–40 g/h' },
          { zone: 'Tempo',     ftp: '75–90%',  carbs: '40–60 g/h' },
          { zone: 'Threshold', ftp: '90–105%', carbs: '60–90 g/h' },
          { zone: 'VO₂max+',   ftp: '>105%',   carbs: '90–120 g/h' },
        ] as row, i}
          <div class="grid text-caption-sm" style="grid-template-columns:1fr auto auto;padding:10px 14px;{i % 2 === 1 ? 'background:rgba(255,255,255,0.04);' : ''}border-top:1px solid rgba(255,255,255,0.07);">
            <span style="color:#ffffff;">{row.zone}</span>
            <span class="text-right pr-4" style="color:rgba(255,255,255,0.5);">{row.ftp}</span>
            <span class="text-right" style="color:rgba(255,255,255,0.75);">{row.carbs}</span>
          </div>
        {/each}
      </div>

      <p class="text-caption-sm mb-sm" style="color:rgba(255,255,255,0.55);">Fluids scale with body weight — sweat modifier adjusts ±20–30%.</p>
      <p class="text-caption-sm mb-lg" style="color:rgba(255,255,255,0.55);">Rides &gt;2h: add electrolytes — plain water dilutes sodium balance on long efforts.</p>

      <button on:click={() => showMathSheet = false}
        class="w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:rgba(255,255,255,0.12);color:#ffffff;">
        Close
      </button>
    </div>
  {/if}
</main>
