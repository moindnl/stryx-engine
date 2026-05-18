<script lang="ts">
  import { Zap, Droplet, ChevronDown, ChevronRight, X, User, UserX, Wheat, Check, RefreshCw, ExternalLink, Moon, Sun } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { linear, cubicOut, cubicIn, quintOut } from 'svelte/easing';
  import { fly, fade, slide } from 'svelte/transition';
  import { onMount, onDestroy, tick } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';
  import { t, lang } from './i18n';

  const VERSION = '1.0';

  let updateAvailable = false;
  let doUpdateSW: () => Promise<void>;

  // Injected at build time by vite.config.js versionPlugin
  const BUILD_HASH = __BUILD_HASH__;

  const swUpdate = registerSW({
    async onNeedRefresh() {
      try {
        const res = await fetch(`/version.json?_=${Date.now()}`);
        if (!res.ok) { updateAvailable = true; return; } // can't check — show prompt
        const data = await res.json();
        if (data.hash !== BUILD_HASH) {
          updateAvailable = true;
        } else {
          swUpdate(false); // same build — apply silently
        }
      } catch {
        updateAvailable = true; // network error — show prompt anyway
      }
    },
    onOfflineReady() {},
  });
  doUpdateSW = swUpdate;

  let showAboutSheet = false;
  let langFlipping = false;
  async function toggleLang() {
    langFlipping = false;
    await tick();
    langFlipping = true;
    lang.update(l => l === 'en' ? 'de' : 'en');
  }

  // Dark / light / system mode
  type Theme = 'light' | 'dark' | 'system';
  let theme: Theme = (localStorage.getItem('bp-theme') as Theme) || 'system';
  let isDark: boolean = false; // reflects actual rendered state (used for tempColor)
  let _sysMq: MediaQueryList | null = null;

  function _resolveAndApply(t: Theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = t === 'dark' || (t === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    isDark = dark;
  }
  function applyTheme(t: Theme) {
    localStorage.setItem('bp-theme', t);
    _resolveAndApply(t);
  }
  function _onSysChange(e: MediaQueryListEvent) {
    if (theme === 'system') { isDark = e.matches; document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light'); }
  }


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
  let distance: number | undefined = undefined;
  let durationRaw = ''; // what user types — e.g. "1.30" or "1:30" or "1.5"
  let power: number | undefined = undefined;
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
  try { _savedProfile = JSON.parse(localStorage.getItem('bp-profile') || '{}'); } catch { /* ignore */ }
  let weight: number | undefined = _savedProfile.weight > 0 ? _savedProfile.weight : undefined;
  let ftp: number | undefined = _savedProfile.ftp > 0 ? _savedProfile.ftp : undefined;
  let imperial: boolean = typeof _savedProfile.imperial === 'boolean' ? _savedProfile.imperial : false;
  let sweatRate: 'light' | 'moderate' | 'heavy' = _savedProfile.sweatRate || 'moderate';

  // UI state
  let showMathSheet = false;
  let showImpressumSheet = false;
  let profileOpen = !(weight > 0 || ftp > 0); // auto-open on first visit
  let rideOpen = false;
  let rideAutoCollapsed = false;
  let neuralizer = false;        // easter egg F: neuralyzer flash
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let totalsTab: 'summary' | 'schedule' | 'pack' = 'summary';
  let tabCard: HTMLElement;
  let setupCard: HTMLElement;
  function switchTab(tab: typeof totalsTab) {
    totalsTab = tab;
    setTimeout(() => {
      if (!tabCard) return;
      const y = tabCard.getBoundingClientRect().top + window.scrollY - 76; // 64px header + 12px gap
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 0);
  }
  let checkedPack: Set<string> = new Set();
  function togglePack(id: string) {
    if (checkedPack.has(id)) checkedPack.delete(id); else checkedPack.add(id);
    checkedPack = checkedPack;
  }
  function resetPack() { checkedPack.clear(); checkedPack = checkedPack; }

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
  let _installOS: 'ios' | 'android' | null = null; // set in onMount if eligible
  let _installFired = false;

  // Fire install prompt on first meaningful engagement (profile complete)
  $: if (_installOS && !_installFired && weight > 0 && ftp > 0) {
    _installFired = true;
    installSheetTimer = setTimeout(() => { installPlatform = _installOS!; }, 800);
  }
  let deferredInstallPrompt: any = null;
  const onBeforeInstallPrompt = (e: Event) => { e.preventDefault(); deferredInstallPrompt = e; };
  const onAppInstalled = () => { installPlatform = null; };
  let sheetDragStartY = 0;
  let sheetDragOffsetY = 0;
  let sheetIsDragging = false;
  let _sheetDismiss: (() => void) | null = null;

  function onSheetDragStart(e: TouchEvent, dismiss: () => void) {
    _sheetDismiss = dismiss;
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
        _sheetDismiss?.();
        _sheetDismiss = null;
        sheetDragOffsetY = 0;
      }, 260);
    } else {
      sheetDragOffsetY = 0;
    }
  }

  onMount(() => {
    // Apply persisted theme and wire system-preference listener
    applyTheme(theme);
    _sysMq = window.matchMedia('(prefers-color-scheme: dark)');
    _sysMq.addEventListener('change', _onSysChange);

    // Easter egg: console greeting
    console.log('bonkproof — Cycling Nutrition Planner\n\nPsst. You\'re looking at the source.\nWhy are you not riding your bike?\n\nBuilt by Daniel Muschinski\nhttps://github.com/moindnl');

    const isMobile = window.innerWidth < 768;
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isMobile && !standalone && (isIos || isAndroid) && !localStorage.getItem('bp-install-dismissed')) {
      _installOS = isIos ? 'ios' : 'android'; // reactive block fires when profile complete
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    _profileReady = true;
  });

  onDestroy(() => {
    if (_sysMq) _sysMq.removeEventListener('change', _onSysChange);
    if (installSheetTimer) clearTimeout(installSheetTimer);
    if (_saveTimer) clearTimeout(_saveTimer);
    if (holdTimer) clearTimeout(holdTimer);
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  function dismissInstallSheet() {
    installPlatform = null;
    // Do NOT reset sheetDragOffsetY/sheetIsDragging here — onSheetDragEnd owns
    // drag state cleanup. Resetting unconditionally would corrupt an active drag
    // on any other sheet (all sheets share the same drag state variables).
    localStorage.setItem('bp-install-dismissed', '1');
  }
  async function triggerInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome === 'accepted') installPlatform = null;
  }
  // Only save after initial load — debounced to avoid writing on every keystroke
  let _profileReady = false;
  let _saveTimer: ReturnType<typeof setTimeout> | null = null;
  $: if (_profileReady) {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      localStorage.setItem('bp-profile', JSON.stringify({ weight, ftp, imperial, sweatRate }));
    }, 600);
  }

  // Guide: hide once both weight + ftp set; never re-show (avoids flicker on delete)
  let _guideSeen = false;
  $: if (weight > 0 && ftp > 0) _guideSeen = true;

  // Reset per-ride inputs only; profile persists
  function resetInputs() {
    distance = undefined; durationRaw = ''; power = undefined; temperature = 20;
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
      if (weight != null && weight > 0)   weight   = Math.round(weight * 2.20462);
      if (distance != null && distance > 0) distance = Math.round(distance * 0.621371 * 10) / 10;
    } else {
      if (weight != null && weight > 0)   weight   = Math.round(weight / 2.20462);
      if (distance != null && distance > 0) distance = Math.round(distance * 1.60934);
    }
    imperial = !imperial;
  }

  // Metric-normalised values used in all calculations
  $: weightKg   = imperial ? (weight ?? 0) / 2.20462 : (weight ?? 0);
  $: distanceKm = imperial ? (distance ?? 0) * 1.60934 : (distance ?? 0);
  $: speedKmh   = distanceKm > 0 && duration > 0 ? distanceKm / duration : 0;
  $: speedUnit  = imperial ? 'mph' : 'km/h';
  $: heatBonus  = temperature > 20 ? Math.round((temperature - 20) / 5 * 0.3 * 10) / 10 : 0;
  $: sweatMultiplier = sweatRate === 'light' ? 0.8 : sweatRate === 'heavy' ? 1.3 : 1.0;
  $: themeIdx = theme === 'light' ? 0 : theme === 'system' ? 1 : 2;
  $: sweatIdx = sweatRate === 'light' ? 0 : sweatRate === 'moderate' ? 1 : 2;
  $: tabIdx = totalsTab === 'summary' ? 0 : totalsTab === 'schedule' ? 1 : 2;
  $: solidIdx = SOLID_PRODUCTS.findIndex(p => p.id === solidProduct);
  $: drinkIdx = DRINK_PRODUCTS.findIndex(p => p.id === drinkProduct);
  $: bottleSizeIdx = bottleSize === 500 ? 0 : bottleSize === 750 ? 1 : 2;

  // Temperature slider: track fill color neutral → #f73b20 above 20°C
  function tempColor(t: number, dark: boolean): string {
    if (t <= 20) return dark ? '#f4f4f5' : '#09090b';
    const p = Math.min((t - 20) / 25, 1);
    // Light: near-black → bright red. Dark: visible red → bright red (same endpoint).
    const r0 = dark ? 160 : 9;
    const g0 = dark ?  40 : 9;
    const b0 = dark ?  30 : 11;
    return `rgb(${Math.round(r0 + (247 - r0) * p)},${Math.round(g0 + (59 - g0) * p)},${Math.round(b0 + (32 - b0) * p)})`;
  }
  $: tempFillColor = tempColor(temperature, isDark);

  // Ping value display when crossing 20°C threshold
  let heatPing = false;
  async function triggerHeatPing() {
    heatPing = false;
    await tick();
    heatPing = true;
  }
  let _prevHeatActive = false;
  $: {
    const nowActive = temperature > 20;
    if (nowActive !== _prevHeatActive) {
      triggerHeatPing();
      _prevHeatActive = nowActive;
    }
  }


  // Power-derived zone
  $: intensityFactor = ftp > 0 && power > 0 ? power / ftp : 0;

  // 🥚 Easter egg B: Tadej mode at ≥500W
  $: tadejMode = power >= 500;


  $: zoneLabel = intensityFactor === 0 ? '' :
    tadejMode ? $t.zoneTadej :
    intensityFactor < 0.55 ? $t.zoneRecovery :
    intensityFactor < 0.75 ? $t.zoneEndurance :
    intensityFactor < 0.90 ? $t.zoneTempo :
    intensityFactor < 1.05 ? $t.zoneThreshold :
    $t.zoneVO2;

  $: zoneBadgeStyle = intensityFactor === 0 ? '' :
    tadejMode
      ? 'background:#f0c000;color:#111111;transition:background 0.35s ease,color 0.35s ease'
      : `background:${
          intensityFactor < 0.55 ? '#a1a1aa' :
          intensityFactor < 0.90 ? '#3f3f46' :
          '#f73b20'
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
  $: carbsPerHour = !duration || !(weight > 0) ? 0 :
    intensityFactor > 0
      ? carbsFromIF(intensityFactor)
      : Math.round((CARB_RANGES[intensity].min + CARB_RANGES[intensity].max) / 2);

  // Energy: kJ mechanical ≈ kcal (cycling standard: 1W × 1h = 3.6 kJ ≈ 3.6 kcal)
  $: kcalPerHour = intensityFactor > 0 ? Math.round(power * 3.6) : 0;

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

  const SPEED_LEVELS = [
    { minKmh: 0,   maxKmh: 10,  key: 'turtle',      tKey: 'turtlePace',        wikiSlug: 'Turtle',           wikiSlugDe: 'Landschildkröten' },
    { minKmh: 10,  maxKmh: 15,  key: 'penguin',     tKey: 'penguinCruise',     wikiSlug: 'Penguin',          wikiSlugDe: 'Pinguine' },
    { minKmh: 15,  maxKmh: 20,  key: 'gazelle',     tKey: 'gazellePace',       wikiSlug: 'Gazelle',          wikiSlugDe: 'Gazellen' },
    { minKmh: 20,  maxKmh: 25,  key: 'cheetah',     tKey: 'cheetahChase',      wikiSlug: 'Cheetah',          wikiSlugDe: 'Gepard' },
    { minKmh: 25,  maxKmh: 30,  key: 'falcon',      tKey: 'falconFlight',      wikiSlug: 'Falcon',           wikiSlugDe: 'Falken' },
    { minKmh: 30,  maxKmh: 40,  key: 'peregrine',   tKey: 'peregrineSpeed',    wikiSlug: 'Peregrine_falcon', wikiSlugDe: 'Wanderfalke' },
    { minKmh: 40,  maxKmh: 55,  key: 'greyhound',   tKey: 'greyhoundSprint',   wikiSlug: 'Greyhound',        wikiSlugDe: 'Greyhound' },
    { minKmh: 55,  maxKmh: 75,  key: 'downhill',    tKey: 'downhillRecord',    wikiSlug: '%C3%89ric_Barone', wikiSlugDe: '%C3%89ric_Barone' },
    { minKmh: 75,  maxKmh: 100, key: 'motorcycle',  tKey: 'motorcycleTerritory', wikiSlug: 'Motorcycle',     wikiSlugDe: 'Motorrad' },
    { minKmh: 100, maxKmh: Infinity, key: 'ambulance', tKey: 'callAmbulance',  wikiSlug: 'Ambulance',        wikiSlugDe: 'Krankenwagen' },
  ] as const;

  $: speedLevel = speedKmh === 0 ? null :
    SPEED_LEVELS.find(s => speedKmh < s.maxKmh) ?? SPEED_LEVELS[SPEED_LEVELS.length - 1];

  $: speedSloganText = speedLevel ? ($t[speedLevel.tKey] as string) : '';
  $: speedSloganUrl  = speedLevel ? `https://${$lang === 'de' ? 'de' : 'en'}.wikipedia.org/wiki/${$lang === 'de' ? speedLevel.wikiSlugDe : speedLevel.wikiSlug}` : '';

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

  $: heatWarning = temperature >= 28; // isolated so packItems doesn't recompute on every slider tick

  $: packItems = (() => {
    if (!duration || !weight) return [] as { id: string; label: string }[];
    const items: { id: string; label: string }[] = [];
    if (totalSolidUnits > 0) {
      const withEmergency = duration >= 2;
      const count = withEmergency ? totalSolidUnits + 1 : totalSolidUnits;
      const suffix = withEmergency ? $t.packItemEmergency : '';
      items.push({ id: 'fuel', label: $t.packItemSolid(count, solidLabel, activeSolid.carbs, suffix) });
    }
    if (bottleCount > 0)
      items.push({ id: 'bottles', label: $t.packItemBottle(bottleCount, bottleSize) });
    if (drinkProduct !== 'water' && bottleCount > 0)
      items.push({ id: 'carbdrink', label: $t.packItemCarbDrink(activeDrink.label, bottleCount) });
    if (heatWarning)
      items.push({ id: 'electrolytes', label: $t.packItemElectrolytes });
    if (duration >= 3)
      items.push({ id: 'cash', label: $t.packItemCash });
    items.push({ id: 'computer', label: $t.packItemComputer });
    items.push({ id: 'phone', label: $t.packItemPhone });
    return items;
  })();

  // Prune checked state for items that no longer exist
  $: {
    if (checkedPack.size > 0) {
      const validIds = new Set(packItems.map(i => i.id));
      let pruned = false;
      checkedPack.forEach(id => { if (!validIds.has(id)) { checkedPack.delete(id); pruned = true; } });
      if (pruned) checkedPack = checkedPack;
    }
  }

  // Fueling schedule: 20-min intake slots (solid food only)
  $: fuelingEvents = (() => {
    if (!duration || !(weight > 0)) return [] as { time: string; carbs: number; units: number }[];
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
    { n: '1', tTitle: 'step1Title', tBody: 'step1Body' },
    { n: '2', tTitle: 'step2Title', tBody: 'step2Body' },
    { n: '3', tTitle: 'step3Title', tBody: 'step3Body' },
  ] as const;


</script>

<main class="min-h-screen">

  <!-- Update toast -->
  {#if updateAvailable}
    <div class="fixed top-0 left-0 right-0 z-[1000] flex justify-center pt-3 px-4 pointer-events-none"
      transition:fly={{ y: -48, duration: 300, easing: cubicOut }}>
      <button on:click={() => doUpdateSW()}
        class="inline-flex items-center gap-sm rounded-full pointer-events-auto active:scale-95 transition-transform"
        style="background:#f73b20;color:#ffffff;box-shadow:0 4px 20px rgba(247,59,32,0.4);padding:10px 20px 10px 16px;cursor:pointer;border:none;">
        <RefreshCw class="w-4 h-4 flex-shrink-0" style="color:rgba(255,255,255,0.75);" />
        <span class="text-body-strong" style="color:#ffffff;">{$t.updateAvailable}</span>
      </button>
    </div>
  {/if}

  <!-- App Header — floating bar -->
  <header class="w-full" style="padding:calc(env(safe-area-inset-top) + 12px) 16px 0;position:sticky;top:0;z-index:995;background:var(--c-bg);">
    <div style="max-width:640px;margin:0 auto;height:52px;background:#09090b;border-radius:9999px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;box-shadow:rgba(255,255,255,0.5) 0px 0.5px 0px 0px inset,rgba(117,123,133,0.4) 0px 9px 14px -5px inset,rgb(44,46,52) 0px 0px 0px 1.5px,rgba(0,0,0,0.14) 0px 4px 6px 0px;">
      <!-- Logo — tappable, opens About sheet -->
      <button class="flex items-center gap-sm" style="background:transparent;border:none;padding:0;cursor:pointer;" on:click={() => showAboutSheet = true} aria-label="About bonkproof!">
        <img src="/favicon.svg" alt="" class="icon-anim" style="width:34px;height:34px;display:block;flex-shrink:0;border-radius:24%;box-shadow:0 0 0 2px #f73b20;" />
        <h1 style="margin:0;font-size:17px;font-weight:700;letter-spacing:-0.02em;line-height:1;"><span class="bonk-nudge" style="color:#ffffff;font-style:italic;font-size:17px;font-weight:700;vertical-align:baseline;">bonk</span><span class="proof-crash" style="color:#f73b20;font-size:17px;font-weight:700;vertical-align:baseline;">proof!</span></h1>
      </button>
      <!-- Right -->
      <div class="flex items-center gap-sm">
        <!-- Profile icon: User when set, UserX when empty -->
        <button
          class="flex items-center justify-center"
          style="width:44px;height:44px;border-radius:50%;background:#ffffff;"
          on:click={(e) => { profileOpen = !profileOpen; if (profileOpen) { rideOpen = false; setTimeout(() => setupCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); } else { (e.currentTarget as HTMLButtonElement).blur(); } }}
          aria-label="{weight > 0 && ftp > 0 ? $t.ariaRiderProfile : $t.ariaSetupProfile}">
          {#if weight > 0 && ftp > 0}
            <User class="w-4 h-4" style="color:#09090b;" />
          {:else}
            <UserX class="w-4 h-4" style="color:#09090b;" />
          {/if}
        </button>
        <!-- Divider -->
        <div style="width:1px;height:20px;background:rgba(255,255,255,0.2);flex-shrink:0;" aria-hidden="true"></div>
        <!-- Theme pill: ☀ · A · 🌙 -->
        <div style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);height:44px;border-radius:999px;background:rgba(255,255,255,0.1);padding:5px;" role="group" aria-label="Theme">
          <div style="position:absolute;left:5px;top:5px;bottom:5px;width:calc((100% - 10px) / 3);border-radius:999px;background:rgba(255,255,255,0.22);box-shadow:0 1px 2px rgba(0,0,0,0.25);transform:translateX(calc({themeIdx} * 100%));transition:transform 0.22s cubic-bezier(0.35,0,0.25,1);pointer-events:none;will-change:transform;"></div>
          <button style="position:relative;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:{theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.4)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);" aria-label="Light theme" aria-pressed={theme === 'light'} on:click={() => { theme = 'light'; applyTheme('light'); }}><Sun class="w-3.5 h-3.5" /></button>
          <button style="position:relative;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:{theme === 'system' ? '#ffffff' : 'rgba(255,255,255,0.4)'};font-size:11px;font-weight:700;letter-spacing:0.03em;transition:color 0.22s cubic-bezier(0.35,0,0.25,1);" aria-label="System theme" aria-pressed={theme === 'system'} on:click={() => { theme = 'system'; applyTheme('system'); }}>A</button>
          <button style="position:relative;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:{theme === 'dark' ? '#ffffff' : 'rgba(255,255,255,0.4)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);" aria-label="Dark theme" aria-pressed={theme === 'dark'} on:click={() => { theme = 'dark'; applyTheme('dark'); }}><Moon class="w-3.5 h-3.5" /></button>
        </div>
        <button
          on:click={toggleLang}
          on:animationend={() => langFlipping = false}
          class="{langFlipping ? 'lang-flip' : ''}"
          style="height:44px;padding:0 12px;border-radius:9999px;background:rgba(255,255,255,0.12);color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.02em;border:none;cursor:pointer;transition:background 0.15s;"
          aria-label="Switch language">
          {$lang === 'en' ? 'DE' : 'EN'}
        </button>
      </div>
    </div>
  </header>


  <div class="max-w-6xl mx-auto p-sm md:p-md lg:p-lg" style="padding-top:12px;">

    <!-- 3-step how-to — shown on first visit or on demand -->
    {#if !_guideSeen}
    <div transition:fade={{ duration: 200 }} class="mb-lg md:mb-section card-enter card-enter-1">
      <!-- Mobile: horizontal swipe cards -->
      <div class="flex md:hidden overflow-x-auto snap-x snap-mandatory gap-sm pb-sm -mx-sm px-sm" style="scrollbar-width:none;-webkit-overflow-scrolling:touch;" tabindex="0" role="region" aria-label="Result cards">
        {#each HOW_TO_STEPS as step, i}
          <div class="snap-center shrink-0 w-[78%] overflow-hidden shimmer-once flex" style="background:var(--c-surface-soft);border-radius:12px;--shimmer-delay:{0.5 + i * 0.1}s"
            in:fly={{ y: 18, duration: 320, delay: 80 + i * 70, easing: cubicOut }}>
            <div class="flex items-center justify-center flex-shrink-0" style="background:var(--c-seg-active);min-width:56px;padding:0 18px 0 14px;clip-path:polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);">
              <span class="text-lg font-bold" style="color:var(--c-seg-active-text);">{step.n}</span>
            </div>
            <div class="p-lg space-y-xs">
              <h2 class="text-body-strong font-bold text-[--color-ink]">{$t[step.tTitle]}</h2>
              <p class="text-caption-md text-[--color-charcoal]">{$t[step.tBody]}</p>
            </div>
          </div>
        {/each}
      </div>
      <!-- Desktop: 3-column grid -->
      <div class="hidden md:grid grid-cols-3 gap-lg overflow-hidden" style="background:var(--c-surface-soft);border-radius:12px;">
        {#each HOW_TO_STEPS as step, i}
          <div class="flex flex-col"
            in:fly={{ y: 18, duration: 320, delay: 80 + i * 70, easing: cubicOut }}>
            <div class="flex items-center justify-center py-md" style="background:var(--c-seg-active);">
              <span class="text-lg font-bold" style="color:var(--c-seg-active-text);">{step.n}</span>
            </div>
            <div class="p-lg space-y-xs flex-1">
              <h2 class="text-body-strong font-bold text-[--color-ink]">{$t[step.tTitle]}</h2>
              <p class="text-caption-md text-[--color-charcoal]">{$t[step.tBody]}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
    {/if}

    <!-- Unified setup card -->
    <div bind:this={setupCard} class="mb-lg card-enter card-enter-2" style="background:var(--c-surface);border-radius:16px;box-shadow:var(--c-shadow-card);overflow:hidden;">

    <!-- Rider Profile -->
    <div>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer focus:outline-none"
        on:click={() => { profileOpen = !profileOpen; if (profileOpen) rideOpen = false; }}
        aria-expanded={profileOpen}
      >
        <span class="text-heading-md font-bold text-[--color-ink]">{$t.riderProfile}</span>
        <div class="flex items-center gap-md">
          {#if !profileOpen}
            <span class="text-caption-sm text-[--color-mute]">
              {#if weight > 0 || ftp > 0}
                {[weight ? `${weight} ${imperial ? 'lbs' : 'kg'}` : null, ftp ? `${ftp} W` : null].filter(Boolean).join(' · ')}
              {:else}
                {$t.notSet}
              {/if}
            </span>
          {/if}
          <ChevronDown class="w-4 h-4 text-[--color-ink] transition-transform duration-300 ease-out {profileOpen ? 'rotate-180' : ''}" />
        </div>
      </button>

      {#if profileOpen}
        <div in:slide={{ duration: 300, easing: quintOut, delay: 80 }} out:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;">

          <!-- Weight -->
          <div class="flex items-center justify-between py-sm">
            <label for="weight" class="text-caption-md font-bold text-[--color-ink]">{$t.bodyWeight}</label>
            <div class="flex items-center gap-xs">
              <input id="weight" type="number" inputmode="decimal" bind:value={weight} min="1" max="400" step="1" placeholder="75"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;padding:0 14px;background:var(--c-surface-input);"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">{imperial ? 'lbs' : 'kg'}</span>
            </div>
          </div>

          <!-- FTP -->
          <div class="flex items-center justify-between py-sm row-sep">
            <div>
              <label for="ftp" class="text-caption-md font-bold text-[--color-ink] block">{$t.ftpLabel}</label>
              <span class="text-caption-sm text-[--color-mute]">{$t.ftpSub}</span>
            </div>
            <div class="flex items-center gap-xs">
              <input id="ftp" type="number" inputmode="numeric" bind:value={ftp} min="0" max="600" step="1" placeholder="280"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;padding:0 14px;background:var(--c-surface-input);"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">W</span>
            </div>
          </div>

          <!-- Units -->
          <div class="flex items-center justify-between py-md gap-md flex-wrap row-sep">
            <span class="text-caption-md font-bold text-[--color-ink]">{$t.units}</span>
            <div style="position:relative;display:flex;border-radius:14px;border:1px solid var(--c-border-input);background:var(--c-surface-seg);padding:3px;">
              <div style="position:absolute;top:3px;bottom:3px;width:calc(50% - 3px);border-radius:10px;background:var(--c-seg-active);box-shadow:0 1px 3px rgba(0,0,0,0.15);transform:translateX({imperial ? 'calc(100% + 3px)' : '0'});transition:transform 0.22s cubic-bezier(0.35,0,0.25,1);pointer-events:none;will-change:transform;"></div>
              <button
                style="position:relative;flex:1;padding:6px 18px;font-size:13px;font-weight:500;white-space:nowrap;color:{!imperial ? 'var(--c-seg-active-text)' : 'var(--c-on-surface-2)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
                on:click={() => { if (imperial) toggleImperial(); }}>{$t.kmKg}</button>
              <button
                style="position:relative;flex:1;padding:6px 18px;font-size:13px;font-weight:500;white-space:nowrap;color:{imperial ? 'var(--c-seg-active-text)' : 'var(--c-on-surface-2)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
                on:click={() => { if (!imperial) toggleImperial(); }}>{$t.miLbs}</button>
            </div>
          </div>

          <!-- Sweat Rate -->
          <div class="flex items-center justify-between py-md gap-md row-sep">
            <div class="flex-shrink-0">
              <span class="text-caption-md font-bold text-[--color-ink] block">{$t.sweatRate}</span>
              <span class="text-caption-sm text-[--color-mute]">
                {sweatRate === 'light' ? $t.sweatLight : sweatRate === 'heavy' ? $t.sweatHeavy : $t.sweatBaseline}
              </span>
            </div>
            <div style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);border-radius:14px;border:1px solid var(--c-border-input);background:var(--c-surface-seg);padding:3px;flex-shrink:0;">
              <div style="position:absolute;left:3px;top:3px;bottom:3px;width:calc((100% - 6px) / 3);border-radius:10px;background:var(--c-seg-active);box-shadow:0 1px 3px rgba(0,0,0,0.15);transform:translateX(calc({sweatIdx} * 100%));transition:transform 0.22s cubic-bezier(0.35,0,0.25,1);pointer-events:none;will-change:transform;"></div>
              {#each SWEAT_LEVELS as { value, drops }, i}
                <button
                  class="flex items-center justify-center gap-[2px]"
                  style="position:relative;padding:6px 12px;color:{sweatRate === value ? 'var(--c-seg-active-text)' : 'var(--c-on-surface-2)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
                  aria-label="{value === 'light' ? $t.sweatLightAria : value === 'moderate' ? $t.sweatModerateAria : $t.sweatHeavyAria}"
                  aria-pressed={sweatRate === value}
                  on:click={() => (sweatRate = value)}>
                  {#each { length: drops } as _}<Droplet class="w-3.5 h-3.5" />{/each}
                </button>
              {/each}
            </div>
          </div>


        </div>
      {/if}
    </div>

    <!-- Ride Input -->
    <div>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer focus:outline-none"
        on:click={() => { rideOpen = !rideOpen; if (rideOpen) profileOpen = false; }}
        aria-expanded={rideOpen}
      >
        <span class="text-heading-md font-bold text-[--color-ink]">{$t.rideLabel}</span>
        <div class="flex items-center gap-md">
          {#if !rideOpen}
            <span class="text-caption-sm text-[--color-mute]">
              {#if duration > 0 || power > 0}
                {[duration > 0 ? formatDuration(duration) : null, power > 0 ? `${power} W` : null, temperature !== 20 ? `${temperature}°C` : null].filter(Boolean).join(' · ')}
              {:else}
                {$t.notSet}
              {/if}
            </span>
          {/if}
          {#if duration > 0 || distance > 0 || power > 0}
            <button
              on:click|stopPropagation={resetInputs}
              on:mousedown={startHold} on:mouseup={cancelHold} on:mouseleave={cancelHold}
              on:touchstart|preventDefault={startHold} on:touchend={cancelHold} on:touchcancel={cancelHold}
              on:contextmenu|preventDefault
              class="flex items-center justify-center flex-shrink-0"
              style="width:28px;height:28px;border-radius:50%;background:var(--c-surface-soft);touch-action:manipulation;user-select:none;-webkit-user-select:none;"
              aria-label="Reset ride inputs">
              <X class="w-3.5 h-3.5 text-[--color-ink]" />
            </button>
          {/if}
          <ChevronDown class="w-4 h-4 text-[--color-ink] transition-transform duration-300 ease-out {rideOpen ? 'rotate-180' : ''}" />
        </div>
      </button>

      {#if rideOpen}
        <div in:slide={{ duration: 300, easing: quintOut, delay: 80 }} out:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;"
          on:focusout={handleRideCardFocusOut}>

          <!-- Distance -->
          <div class="flex items-center justify-between py-sm">
            <label for="distance" class="text-caption-md font-bold text-[--color-ink]">
              {$t.distance} <span class="text-caption-sm text-[--color-mute] font-normal">{$t.distanceOptional}</span>
            </label>
            <div class="flex items-center gap-xs">
              <input id="distance" type="number" inputmode="numeric" bind:value={distance} min="1" max="500" step="1" placeholder="0"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;padding:0 14px;background:var(--c-surface-input);"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">{imperial ? 'mi' : 'km'}</span>
            </div>
          </div>

          <!-- Duration -->
          <div class="flex items-center justify-between py-sm row-sep">
            <div>
              <label for="duration" class="text-caption-md font-bold text-[--color-ink] block">{$t.durationLabel}</label>
              <p class="text-utility-xs text-[--color-stone] mt-xxs">{$t.durationHint}</p>
            </div>
            <div class="flex items-center gap-xs">
              <input id="duration" type="text" inputmode="decimal" bind:value={durationRaw}
                placeholder="1:30"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;padding:0 14px;background:var(--c-surface-input);"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">h</span>
            </div>
          </div>

          <!-- Power -->
          <div class="flex items-center justify-between py-sm row-sep">
            <div>
              <label for="power" class="text-caption-md font-bold text-[--color-ink] block">{$t.ridePower}</label>
              <span class="text-caption-sm text-[--color-mute]">{$t.ridePowerSub}</span>
            </div>
            <div class="flex items-center gap-xs">
              <input id="power" type="number" inputmode="numeric" bind:value={power} min="0" max="600" step="1" placeholder="200"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;padding:0 14px;background:var(--c-surface-input);"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">W</span>
            </div>
          </div>

          <!-- Zone (derived) -->
          <div class="flex items-center justify-between py-md row-sep">
            <span class="text-caption-md font-bold text-[--color-ink]">{$t.zoneLabel}</span>
            <div class="flex items-center">
              {#if intensityFactor > 0 && zoneLabel}
                <span class="badge" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}%</span>
              {:else if !(ftp > 0)}
                <button class="text-caption-sm flex items-center gap-xxs text-[--color-mute]"
                  on:click={() => { profileOpen = true; rideOpen = false; }}>
                  {$t.setFtpFirst} <ChevronRight class="w-3 h-3" />
                </button>
              {:else}
                <span class="text-caption-sm text-[--color-mute]">{$t.enterPower}</span>
              {/if}
            </div>
          </div>

          <!-- Temperature -->
          <div class="py-md row-sep">
            <div class="flex items-center justify-between mb-sm">
              <label for="temperature" class="text-caption-md font-bold text-[--color-ink]">{$t.temperature}</label>
              <!-- °C intentional — heat formula is Celsius-based regardless of unit preference -->
              <span class="text-caption-md font-bold {heatPing ? 'heat-ping' : ''}"
                on:animationend={() => heatPing = false}
                style="color:{tempFillColor};">{temperature}°C</span>
            </div>
            <input id="temperature" type="range" bind:value={temperature} min="0" max="45" step="1"
              class="temp-slider w-full"
              style="--fill:{(temperature / 45 * 100).toFixed(1)}%;--temp-color:{tempFillColor}" />
            <p class="text-caption-sm mt-md {heatBonus > 0 ? 'text-[--color-sale]' : 'text-[--color-mute]'}">
              {heatBonus > 0 ? $t.heatActive(heatBonus.toFixed(1)) : $t.heatInactive}
            </p>
          </div>

        </div>
      {/if}
    </div>

    </div><!-- /Unified setup card -->

    {#if duration > 0 && (weight > 0)}

    <!-- Results Row 1: Carbs + Fluids (primary output) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg mb-lg card-enter card-enter-3">

      <!-- Carbs card -->
      <div class="p-lg" style="background:var(--c-surface);border-radius:16px;box-shadow:var(--c-shadow-card);">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 flex items-center justify-center flex-shrink-0" style="background:var(--c-surface-soft);border-radius:14px;">
            <Wheat class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">{$t.carbohydrates}</h2>
            <p class="text-caption-sm text-[--color-mute]">{$t.carbsSub}</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key carbsPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold {carbsPerHour > 0 ? 'num-flash' : ''}" style="color:{carbsPerHour > 0 ? 'var(--color-ink)' : 'var(--c-num-empty)'};transition:color 0.3s ease;">{Math.round($animatedCarbs)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">g/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">
          {#if intensityFactor > 0}
            {$t.carbsFromPower(power, Math.round(intensityFactor * 100))}
          {:else}
            {$t.carbsEstimated}
          {/if}
        </p>
        {#if multiCarbNote}
          <p class="text-caption-sm text-[--color-mute] mt-sm">{$t.carbsMultiNote}</p>
        {/if}
      </div>

      <!-- Fluids card -->
      <div class="p-lg" style="background:var(--c-surface);border-radius:16px;box-shadow:var(--c-shadow-card);">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 flex items-center justify-center flex-shrink-0" style="background:var(--c-surface-soft);border-radius:14px;">
            <Droplet class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">{$t.fluids}</h2>
            <p class="text-caption-sm text-[--color-mute]">{$t.fluidsSub}</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key fluidPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold {fluidPerHour > 0 ? 'num-flash' : ''}" style="color:{fluidPerHour > 0 ? 'var(--color-ink)' : 'var(--c-num-empty)'};transition:color 0.3s ease;">{$animatedFluid.toFixed(1)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">L/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">{$t.fluidsBased}</p>
        {#if sweatRate !== 'moderate'}
          <p class="text-caption-sm text-[--color-mute] mt-xs">{sweatRate === 'light' ? $t.fluidsLightNote('−20%') : $t.fluidsHeavyNote('+30%')}</p>
        {/if}
        {#if heatBonus > 0}
          <p class="text-caption-sm text-[--color-sale] mt-xs">{$t.fluidsHeatNote(heatBonus.toFixed(1), temperature)}</p>
        {/if}
      </div>
    </div>

    <!-- Results Row 2: Power (+ speed when available) -->
    <div class="p-lg mb-lg card-enter card-enter-4" style="background:var(--c-surface);border-radius:16px;box-shadow:var(--c-shadow-card);">
      <div class="flex items-start gap-md mb-lg">
        <div class="w-12 h-12 flex items-center justify-center flex-shrink-0" style="background:var(--c-surface-soft);border-radius:14px;">
          <Zap class="w-7 h-7 text-[--color-ink]" />
        </div>
        <div class="min-w-0">
          <h2 class="text-heading-lg font-bold text-[--color-ink]">{$t.powerLabel}</h2>
          <p class="text-caption-sm text-[--color-mute]">{$t.powerSub}</p>
        </div>
      </div>
      <div class="mb-md">
        <div class="flex items-baseline gap-sm">
          <span class="text-7xl md:text-8xl font-extra-bold" style="color:{power > 0 ? 'var(--c-on-surface)' : 'var(--c-num-empty)'};transition:color 0.3s ease;">{power ?? 0}</span>
          <span class="text-3xl text-[--color-mute]">W</span>
        </div>
      </div>
      {#if intensityFactor > 0}
        <div class="flex items-center gap-sm flex-wrap">
          <span class="badge" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}% FTP</span>
          <span class="badge" style="background:var(--color-accent);color:#ffffff;">~{Math.round($animatedKcalPerHour)} kcal/h</span>
        </div>
      {:else}
        <p class="text-caption-sm text-[--color-mute]">{$t.powerEnterHint}</p>
      {/if}
      {#if speedKmh > 0}
        <div class="flex items-center justify-between mt-md pt-md row-sep">
          <div class="flex items-baseline gap-sm">
            <span class="text-heading-md font-bold text-[--color-ink]">{Math.round($animatedSpeed)}</span>
            <span class="text-caption-md text-[--color-mute]">{speedUnit}</span>
          </div>
          {#if speedSloganText}
            <a href={speedSloganUrl} target="_blank" rel="noopener noreferrer">
              <span class="badge inline-flex items-center gap-xs">
                {speedSloganText}
                <ExternalLink class="w-3 h-3" />
              </span>
            </a>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Totals + Fueling Schedule + Bottle Planner — tabbed dark card -->
    <div bind:this={tabCard} class="card-campaign rounded-sm p-lg md:p-xl mb-xl card-enter card-enter-5">

      <!-- Tab bar -->
      <div style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:18px;background:rgba(255,255,255,0.08);border-radius:14px;border:1px solid rgba(255,255,255,0.12);padding:3px;">
        <div style="position:absolute;left:3px;top:3px;bottom:3px;width:calc((100% - 6px) / 3);border-radius:10px;background:rgba(255,255,255,0.92);box-shadow:0 1px 3px rgba(0,0,0,0.3);transform:translateX(calc({tabIdx} * 100%));transition:transform 0.22s cubic-bezier(0.35,0,0.25,1);pointer-events:none;will-change:transform;"></div>
        <button
          style="position:relative;flex:1;padding:6px 10px;border-radius:10px;font-size:13px;font-weight:500;white-space:nowrap;color:{totalsTab === 'summary' ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
          on:click={() => switchTab('summary')}>{$t.tabTotals}</button>
        <button
          style="position:relative;flex:1;padding:6px 10px;border-radius:10px;font-size:13px;font-weight:500;white-space:nowrap;color:{totalsTab === 'schedule' ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
          on:click={() => switchTab('schedule')}>{$t.tabSchedule}</button>
        <button
          style="position:relative;flex:1;padding:6px 10px;border-radius:10px;font-size:13px;font-weight:500;white-space:nowrap;color:{totalsTab === 'pack' ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
          on:click={() => switchTab('pack')}>{$t.tabPack}</button>
      </div>

      <!-- Totals tab -->
      {#if totalsTab === 'summary'}
        <div in:fade={{ duration: 250 }}>
        <h2 class="text-caption-md mb-lg text-[--color-on-primary]">{$t.totalNeeds(formatDuration(duration))}</h2>
        <div class="grid grid-cols-3 gap-md">
          <div class="rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold mb-xs" style="color:#ffffff;">{Math.round($animatedTotalCarbs)}g</div>
            <div class="text-caption-sm" style="color:rgba(255,255,255,0.70);">{$t.carbsLabel}</div>
          </div>
          <div class="rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold mb-xs flex items-center justify-center" style="color:#ffffff;min-height:1.2em;">
              {intensityFactor > 0 ? Math.round($animatedTotalKcal) : '—'}
            </div>
            <div class="text-caption-sm" style="color:rgba(255,255,255,0.70);">{$t.kcal}</div>
          </div>
          <div class="rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold mb-xs" style="color:#ffffff;">{$animatedTotalFluid.toFixed(1)}L</div>
            <div class="text-caption-sm" style="color:rgba(255,255,255,0.70);">{$t.fluidsLabel}</div>
          </div>
        </div>
        </div>

      <!-- Schedule tab -->
      {:else if totalsTab === 'schedule'}
        <div in:fade={{ duration: 250 }}>
        <!-- Solid product picker -->
        <div class="flex items-center justify-between mb-md flex-wrap gap-sm">
          <span style="color:rgba(255,255,255,0.7);font-size:13px;">{$t.solidFood}</span>
          <div style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);border-radius:14px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);padding:3px;flex-shrink:0;">
            <div style="position:absolute;left:3px;top:3px;bottom:3px;width:calc((100% - 6px) / 3);border-radius:10px;background:rgba(255,255,255,0.92);box-shadow:0 1px 3px rgba(0,0,0,0.3);transform:translateX(calc({solidIdx} * 100%));transition:transform 0.22s cubic-bezier(0.35,0,0.25,1);pointer-events:none;will-change:transform;"></div>
            {#each SOLID_PRODUCTS as p}
              <button
                style="position:relative;padding:6px 10px;font-size:13px;font-weight:500;text-align:center;white-space:nowrap;color:{solidProduct === p.id ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
                on:click={() => (solidProduct = p.id)}>{p.label} ({p.carbs}g)</button>
            {/each}
          </div>
        </div>
        {#if fuelingEvents.length === 0}
          <p style="color:rgba(255,255,255,0.70);font-size:14px;">{$t.rideTooShort}</p>
        {:else if fuelingEvents[0].carbs === 0}
          <p style="color:rgba(255,255,255,0.70);font-size:14px;">{$t.drinkCoversAll}</p>
        {:else}
          <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">
            {#each fuelingEvents as event, i}
              <div class="flex items-center justify-between px-lg py-md"
                style="{i < fuelingEvents.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.08);' : ''}">
                <span style="color:rgba(255,255,255,0.70);font-size:13px;font-variant-numeric:tabular-nums;min-width:2.6rem;">{event.time}</span>
                <span style="color:#ffffff;font-weight:700;font-size:15px;">{event.carbs}g</span>
                <span style="color:rgba(255,255,255,0.70);font-size:12px;">{event.units}× {solidLabel}</span>
              </div>
            {/each}
          </div>
          <div class="flex items-center justify-between mt-md">
            <p style="color:rgba(255,255,255,0.70);font-size:12px;">{$t.firstFuel}</p>
            <p style="color:rgba(255,255,255,0.70);font-size:12px;font-weight:600;">{$t.solidUnitsTotal(totalSolidUnits, solidLabel)}</p>
          </div>
          {#if drinkCarbsPerHour > 0}
            <p style="color:rgba(255,255,255,0.70);font-size:11px;margin-top:6px;">{$t.reducedByDrink(drinkCarbsPerHour)}</p>
          {/if}
        {/if}
        </div>

      <!-- Pack tab (bottles + checklist) -->
      {:else if totalsTab === 'pack'}
        <div in:fade={{ duration: 250 }}>
        {#if bottleCount === 0}
          <p style="color:rgba(255,255,255,0.70);font-size:14px;">{$t.noBottles}</p>
        {:else}
          <!-- Drink product picker -->
          <div class="flex items-center justify-between mb-md flex-wrap gap-sm">
            <span style="color:rgba(255,255,255,0.7);font-size:13px;">{$t.drinkType}</span>
            <div style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);border-radius:14px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);padding:3px;flex-shrink:0;">
              <div style="position:absolute;left:3px;top:3px;bottom:3px;width:calc((100% - 6px) / 3);border-radius:10px;background:rgba(255,255,255,0.92);box-shadow:0 1px 3px rgba(0,0,0,0.3);transform:translateX(calc({drinkIdx} * 100%));transition:transform 0.22s cubic-bezier(0.35,0,0.25,1);pointer-events:none;will-change:transform;"></div>
              {#each DRINK_PRODUCTS as p}
                <button
                  style="position:relative;padding:6px 10px;font-size:12px;font-weight:500;text-align:center;white-space:nowrap;color:{drinkProduct === p.id ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;"
                  on:click={() => (drinkProduct = p.id)}>{p.label}</button>
              {/each}
            </div>
          </div>
          <!-- Bottle size selector -->
          <div class="flex items-center justify-between mb-lg flex-wrap gap-sm">
            <span style="color:rgba(255,255,255,0.7);font-size:13px;">{$t.bottleSize}</span>
            <div style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);border-radius:14px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);padding:3px;flex-shrink:0;">
              <div style="position:absolute;left:3px;top:3px;bottom:3px;width:calc((100% - 6px) / 3);border-radius:10px;background:rgba(255,255,255,0.92);box-shadow:0 1px 3px rgba(0,0,0,0.3);transform:translateX(calc({bottleSizeIdx} * 100%));transition:transform 0.22s cubic-bezier(0.35,0,0.25,1);pointer-events:none;will-change:transform;"></div>
              <button style="position:relative;padding:6px 14px;font-size:13px;font-weight:500;text-align:center;color:{bottleSize === 500 ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;" on:click={() => (bottleSize = 500)}>500ml</button>
              <button style="position:relative;padding:6px 14px;font-size:13px;font-weight:500;text-align:center;color:{bottleSize === 750 ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;" on:click={() => (bottleSize = 750)}>750ml</button>
              <button style="position:relative;padding:6px 14px;font-size:13px;font-weight:500;text-align:center;color:{bottleSize === 1000 ? '#09090b' : 'rgba(255,255,255,0.55)'};transition:color 0.22s cubic-bezier(0.35,0,0.25,1);background:transparent;border:none;" on:click={() => (bottleSize = 1000)}>1L</button>
            </div>
          </div>
          <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">
            <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.12);">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">{$t.bottlesNeeded}</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{bottleCount}</span>
            </div>
            <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.12);">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">{$t.fluidPerBottle}</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{mlPerBottle} ml</span>
            </div>
            {#if drinkCarbsPerBottle > 0}
              <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.12);">
                <span style="color:rgba(255,255,255,0.6);font-size:14px;">{$t.carbsFromDrink}</span>
                <span style="color:#fff;font-weight:700;font-size:15px;">{drinkCarbsPerBottle} g/bottle</span>
              </div>
            {/if}
            <div class="flex items-center justify-between px-lg py-md">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">{$t.extraSolidCarbs}</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{Math.max(0, carbsPerBottle)} g/bottle</span>
            </div>
          </div>
          {#if drinkCarbsPerHour > 0}
            <p style="color:rgba(255,255,255,0.70);font-size:11px;margin-top:10px;">{$t.drinkCoversCarbs(drinkCarbsPerHour)}</p>
          {:else}
            <p style="color:rgba(255,255,255,0.70);font-size:12px;margin-top:10px;">{$t.waterOnly}</p>
          {/if}

          <!-- Pack checklist -->
          {#if packItems.length > 0}
            <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.12);padding-top:16px;">
              <div class="flex items-center justify-between mb-md">
                <span style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">{$t.packList}</span>
                {#if checkedPack.size > 0}
                  <button style="color:rgba(255,255,255,0.70);font-size:11px;" on:click={resetPack}>{$t.reset}</button>
                {/if}
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                {#each packItems as item}
                  {@const checked = checkedPack.has(item.id)}
                  <button
                    class="flex items-center gap-md text-left"
                    on:click={() => togglePack(item.id)}>
                    <div style="width:22px;height:22px;border-radius:6px;border:1.5px solid {checked ? '#ffffff' : 'rgba(255,255,255,0.25)'};background:{checked ? '#ffffff' : 'transparent'};flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;">
                      {#if checked}
                        <Check class="w-3 h-3" style="color:#09090b;" />
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

    {:else}
    <!-- Results empty state -->
    <div class="awesomic-card rounded-sm py-md px-lg text-center mb-xl card-enter card-enter-3"
      transition:fade={{ duration: 200 }}>
      <p class="text-caption-md text-[--color-mute]">{$t.emptyState}</p>
    </div>
    {/if}

    <!-- bottom safe-area spacer -->
    <div style="padding-bottom:max(24px, env(safe-area-inset-bottom));"></div>

  </div>

  <!-- About sheet -->
  {#if showAboutSheet}
    <div class="fixed inset-0 z-[996] bg-black/55"
      on:click={() => showAboutSheet = false} role="presentation"
      transition:fade={{ duration: 300 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[998] rounded-t-[28px] px-6 pt-5 max-w-lg mx-auto"
      style="background:var(--c-surface);color:var(--c-on-surface);box-shadow:var(--c-shadow-sheet);padding-bottom:max(32px,calc(env(safe-area-inset-bottom,0px) + 16px));transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.4s cubic-bezier(0.22,1,0.36,1)'};"
      on:touchstart={(e) => onSheetDragStart(e, () => showAboutSheet = false)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 500, duration: 420, easing: quintOut }}
      out:fly={{ y: 500, duration: 240, easing: cubicIn }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:var(--c-drag-handle);"></div>

      <!-- App identity -->
      <div class="flex items-center gap-md mb-lg">
        <img src="/favicon.svg" alt="" class="w-10 h-10 flex-shrink-0" style="border-radius:18%;" />
        <div>
          <p class="text-heading-md font-extra-bold" style="color:var(--c-on-surface);"><span style="font-style:italic;">bonk</span><span style="color:#f73b20;">proof!</span></p>
          <p class="text-caption-sm" style="color:var(--c-on-surface-2);">v{VERSION}</p>
        </div>
      </div>

      <p class="text-body-md mb-lg" style="color:var(--c-on-surface-3);">{$t.aboutDesc}</p>

      <div style="border-radius:14px;overflow:hidden;border:1px solid var(--c-border);margin-bottom:24px;">
        <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid var(--c-border);">
          <span style="color:var(--c-on-surface-2);font-size:14px;">{$t.dataStorage}</span>
          <span style="color:var(--c-on-surface);font-weight:600;font-size:14px;">{$t.dataStorageVal}</span>
        </div>
        <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid var(--c-border);">
          <span style="color:var(--c-on-surface-2);font-size:14px;">{$t.serverRequests}</span>
          <span style="color:var(--c-on-surface);font-weight:600;font-size:14px;">{$t.serverRequestsVal}</span>
        </div>
        <div class="flex items-center justify-between px-lg py-md">
          <span style="color:var(--c-on-surface-2);font-size:14px;">{$t.worksOffline}</span>
          <span style="color:var(--c-on-surface);font-weight:600;font-size:14px;">{$t.worksOfflineVal}</span>
        </div>
      </div>

      <div style="border-radius:14px;overflow:hidden;border:1px solid var(--c-border);margin-bottom:16px;">
        <button class="flex items-center justify-between w-full px-lg py-md" style="background:transparent;border:none;border-bottom:1px solid var(--c-border);" on:click={() => { showAboutSheet = false; setTimeout(() => showMathSheet = true, 60); }}>
          <span style="color:var(--c-on-surface);font-size:15px;">{$t.howItWorks}</span>
          <ChevronRight size={16} style="color:var(--c-on-surface-2);flex-shrink:0;" />
        </button>
        <button class="flex items-center justify-between w-full px-lg py-md" style="background:transparent;border:none;" on:click={() => { showAboutSheet = false; setTimeout(() => showImpressumSheet = true, 60); }}>
          <span style="color:var(--c-on-surface);font-size:15px;">{$t.legal}</span>
          <ChevronRight size={16} style="color:var(--c-on-surface-2);flex-shrink:0;" />
        </button>
      </div>

      <div class="flex gap-sm">
        <button on:click={() => showAboutSheet = false}
          class="flex-1 py-3 rounded-full text-button-md font-extra-bold"
          style="background:var(--c-surface-soft);color:var(--c-on-surface);border:1px solid var(--c-border-input);">
          {$t.close}
        </button>
        <a href="mailto:moindnl@proton.me"
          class="flex-1 py-3 rounded-full text-button-md font-extra-bold text-center"
          style="background:var(--c-seg-active);color:var(--c-seg-active-text);text-decoration:none;">
          E-Mail <ExternalLink size={14} style="display:inline;vertical-align:middle;margin-left:4px;" />
        </a>
      </div>
    </div>
  {/if}

  <!-- PWA install bottom sheet -->
  {#if installPlatform}
    <div class="fixed inset-0 z-[996] bg-black/55"
      on:click={dismissInstallSheet} role="presentation" transition:fade={{ duration: 300 }}>
    </div>
    <div class="fixed bottom-0 left-0 right-0 z-[998] rounded-t-[28px] px-6 pt-5 max-w-lg mx-auto"
      style="background:var(--c-surface);color:var(--c-on-surface);box-shadow:var(--c-shadow-sheet);padding-bottom:max(32px,calc(env(safe-area-inset-bottom,0px) + 16px));transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.4s cubic-bezier(0.22,1,0.36,1)'};"
      on:touchstart={(e) => onSheetDragStart(e, dismissInstallSheet)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 500, duration: 420, easing: quintOut }}
      out:fly={{ y: 500, duration: 240, easing: cubicIn }}>
      <!-- Drag handle -->
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:var(--c-drag-handle);"></div>

      <div class="mb-4">
        <p class="text-heading-md font-extra-bold" style="color:var(--c-on-surface);">{$t.installTitle}</p>
        <p class="text-caption-md mt-1" style="color:var(--c-on-surface-2);">{$t.installSub}</p>
      </div>

      {#if installPlatform === 'ios'}
        <ol class="space-y-3 text-body-md">
          <li class="flex items-start gap-3">
            <span class="badge text-xs shrink-0 mt-0.5">1</span>
            <span>{@html $t.iosStep1}</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge text-xs shrink-0 mt-0.5">2</span>
            <span>{@html $t.iosStep2}</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge text-xs shrink-0 mt-0.5">3</span>
            <span>{@html $t.iosStep3}</span>
          </li>
        </ol>
        <p class="text-caption-sm mt-4" style="color:var(--c-on-surface-2);">{$t.iosSafariNote}</p>
      {:else}
        {#if deferredInstallPrompt}
          <button on:click={triggerInstall}
            class="w-full py-3 rounded-full text-button-md font-extra-bold mb-4"
            style="background:var(--c-seg-active);color:var(--c-seg-active-text);">
            {$t.installNow}
          </button>
        {:else}
          <ol class="space-y-3 text-body-md">
            <li class="flex items-start gap-3">
              <span class="badge text-xs shrink-0 mt-0.5">1</span>
              <span>{@html $t.androidStep1}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="badge text-xs shrink-0 mt-0.5">2</span>
              <span>{@html $t.androidStep2}</span>
            </li>
          </ol>
          <p class="text-caption-sm mt-4" style="color:var(--c-on-surface-2);">{$t.androidNote}</p>
        {/if}
      {/if}

      <button on:click={dismissInstallSheet}
        class="mt-6 w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:var(--c-surface-soft);color:var(--c-on-surface);border:1px solid var(--c-border-input);">
        {$t.notNow}
      </button>
    </div>
  {/if}

  <!-- Easter egg F: neuralyzer flash -->
  {#if neuralizer}
    <div class="fixed inset-0 z-[999] flex flex-col items-center justify-center"
      style="background:rgba(0,0,0,0.88);animation:neuralizer-flash 2.9s ease forwards;">
      <p style="font-size:clamp(14px,3vw,18px);font-weight:700;color:#ffffff;text-align:center;max-width:420px;padding:0 24px;line-height:1.6;opacity:0;animation:neuralizer-text 2.9s ease forwards;">
        {$t.neuralyzerText}
      </p>
    </div>
  {/if}

  <!-- Impressum sheet -->
  {#if showImpressumSheet}
    <div class="fixed inset-0 z-[996] bg-black/55"
      on:click={() => showImpressumSheet = false} role="presentation"
      transition:fade={{ duration: 300 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[998] rounded-t-[28px] px-6 pt-5 max-w-lg mx-auto"
      style="background:var(--c-surface);color:var(--c-on-surface);box-shadow:var(--c-shadow-sheet);padding-bottom:max(32px,calc(env(safe-area-inset-bottom,0px) + 16px));transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.4s cubic-bezier(0.22,1,0.36,1)'};"
      on:touchstart={(e) => onSheetDragStart(e, () => showImpressumSheet = false)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 500, duration: 420, easing: quintOut }}
      out:fly={{ y: 500, duration: 240, easing: cubicIn }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:var(--c-drag-handle);"></div>
      <p class="text-heading-md font-extra-bold mb-lg" style="color:var(--c-on-surface);">{$t.impressum}</p>

      <p class="text-caption-sm mb-xs" style="color:var(--c-on-surface-2);">{$t.impressumSub}</p>
      <div style="border-radius:14px;overflow:hidden;border:1px solid var(--c-border);margin-bottom:20px;">
        <div class="px-lg py-md" style="border-bottom:1px solid var(--c-border);">
          <p style="color:var(--c-on-surface);font-size:14px;font-weight:600;">Daniel Muschinski</p>
          <p style="color:var(--c-on-surface-2);font-size:13px;margin-top:2px;">Freudenbegrstraße 4, 28213 Bremen</p>
        </div>
        <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid var(--c-border);">
          <span style="color:var(--c-on-surface-2);font-size:14px;">{$t.impressumContact}</span>
          <a href="mailto:moindnl@proton.me"
            style="color:var(--c-on-surface);font-size:14px;font-weight:600;text-decoration:none;">moindnl@proton.me</a>
        </div>
        <div class="px-lg py-md">
          <p style="color:var(--c-on-surface-2);font-size:13px;line-height:1.5;">{$t.impressumNote}</p>
        </div>
      </div>

      <button on:click={() => showImpressumSheet = false}
        class="w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:var(--c-surface-soft);color:var(--c-on-surface);border:1px solid var(--c-border-input);">
        {$t.close}
      </button>
    </div>
  {/if}

  <!-- Math sheet -->
  {#if showMathSheet}
    <div class="fixed inset-0 z-[996] bg-black/55"
      on:click={() => showMathSheet = false} role="presentation"
      transition:fade={{ duration: 300 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[998] rounded-t-[28px] px-6 pt-5 max-w-lg mx-auto"
      style="background:var(--c-surface);color:var(--c-on-surface);box-shadow:var(--c-shadow-sheet);padding-bottom:max(32px,calc(env(safe-area-inset-bottom,0px) + 16px));transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.4s cubic-bezier(0.22,1,0.36,1)'};"
      on:touchstart={(e) => onSheetDragStart(e, () => showMathSheet = false)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 500, duration: 420, easing: quintOut }}
      out:fly={{ y: 500, duration: 240, easing: cubicIn }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:var(--c-drag-handle);"></div>
      <p class="text-heading-md font-extra-bold mb-lg" style="color:var(--c-on-surface);">{$t.howMathWorks}</p>

      <div class="mb-lg" style="border-radius:14px;overflow:hidden;border:1px solid var(--c-border);">
        <div class="grid text-caption-sm font-extra-bold uppercase" style="grid-template-columns:16px 1fr 68px 88px;background:var(--c-surface-soft);padding:8px 14px;gap:8px;color:var(--c-on-surface-2);letter-spacing:0.05em;">
          <span></span><span>{$t.zoneCol}</span><span class="text-right">{$t.ftpCol}</span><span class="text-right">{$t.carbsCol}</span>
        </div>
        {#each $t.mathZones as row, i}
          {@const dotColor = i === 0 ? '#a1a1aa' : i < 3 ? '#3f3f46' : '#f73b20'}
          <div class="grid text-caption-sm items-center" style="grid-template-columns:16px 1fr 68px 88px;padding:10px 14px;gap:8px;border-top:1px solid var(--c-border);">
            <span style="width:8px;height:8px;border-radius:50%;background:{dotColor};display:block;flex-shrink:0;"></span>
            <span style="color:var(--c-on-surface);font-weight:500;">{row.zone}</span>
            <span class="text-right" style="color:var(--c-on-surface-2);">{row.ftp}</span>
            <span class="text-right" style="color:var(--c-on-surface-3);font-weight:600;">{row.carbs}</span>
          </div>
        {/each}
      </div>

      <p class="text-caption-sm mb-sm" style="color:var(--c-on-surface-2);">{$t.mathFluidNote}</p>
      <p class="text-caption-sm mb-sm" style="color:var(--c-on-surface-2);">{$t.mathHeatNote}</p>
      <p class="text-caption-sm mb-lg" style="color:var(--c-on-surface-2);">{$t.mathElectroNote}</p>

      <button on:click={() => showMathSheet = false}
        class="w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:var(--c-surface-soft);color:var(--c-on-surface);border:1px solid var(--c-border-input);">
        {$t.close}
      </button>
    </div>
  {/if}
</main>
