import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * CajaMaster POS - Professional Minimalist Icon Design
 * 
 * Concept:
 * - Uncluttered, bold, modern, recognizable at any size (from 16px to 1024px)
 * - Harmonious with the app layout colors:
 *   - Dark Slate base: #0F172A / #1E293B
 *   - Vibrant Emerald green: #10B981 / #34D399 (Sales, Cash, POS Success)
 *   - Warm Amber / Gold: #F59E0B / #FBBF24 (Value, Security, Revenue)
 *   - Sky Cyan accent: #38BDF8
 *   - Clean White / Crisp Light Slate: #FFFFFF / #F8FAFC / #94A3B8
 */

// 1. Full Square / Squircle Icon SVG (1024x1024)
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0B1120"/>
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#10B981" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Dark Slate Background with Rounded Squircle (App Layout Theme: #0F172A) -->
  <rect width="1024" height="1024" rx="224" fill="url(#bgGrad)"/>
  
  <!-- Subtle inner ambient edge border -->
  <rect x="20" y="20" width="984" height="984" rx="204" fill="none" stroke="#334155" stroke-width="6" opacity="0.4"/>

  <!-- GLYPH GROUP (Centered within safe area: 512, 512) -->
  <g transform="translate(512, 512)">
    
    <!-- 1. Minimalist Receipt / Ticket (Emerging from top) -->
    <g transform="translate(0, -145)">
      <!-- Ticket Paper -->
      <path d="M-150,-160 L150,-160 L150,110 L100,85 L50,110 L0,85 L-50,110 L-100,85 L-150,110 Z" fill="#F8FAFC"/>
      
      <!-- Top Amber Brand Accent Strip -->
      <rect x="-115" y="-125" width="125" height="18" rx="9" fill="url(#goldGrad)"/>
      <circle cx="95" cy="-116" r="14" fill="url(#goldGrad)"/>
      
      <!-- Clean Content Strip -->
      <rect x="-115" y="-85" width="230" height="14" rx="7" fill="#94A3B8" opacity="0.8"/>
      <rect x="-115" y="-55" width="160" height="14" rx="7" fill="#CBD5E1" opacity="0.8"/>
      
      <!-- Emerald Total Strip -->
      <rect x="-115" y="-18" width="230" height="36" rx="12" fill="url(#emeraldGrad)"/>
      <rect x="-90" y="-7" width="80" height="14" rx="7" fill="#FFFFFF"/>
      <circle cx="75" cy="0" r="7" fill="#FFFFFF"/>
      <circle cx="95" cy="0" r="7" fill="#FFFFFF"/>
    </g>

    <!-- 2. POS Terminal Base Platform Shadow -->
    <rect x="-240" y="240" width="480" height="40" rx="20" fill="#000000" opacity="0.6"/>
    
    <!-- 3. Cash Drawer / Base Unit -->
    <rect x="-230" y="140" width="460" height="115" rx="30" fill="#1E293B" stroke="#334155" stroke-width="8"/>
    <!-- Cash Drawer Slot -->
    <rect x="-110" y="190" width="220" height="16" rx="8" fill="#0B1120"/>
    <!-- Golden Keyhole / Lock Status -->
    <circle cx="130" cy="198" r="9" fill="url(#goldGrad)"/>

    <!-- 4. Main POS Register Terminal Body -->
    <rect x="-270" y="-45" width="540" height="215" rx="36" fill="#0B1120" stroke="#334155" stroke-width="10" filter="url(#softGlow)"/>
    
    <!-- Terminal Screen Frame -->
    <rect x="-246" y="-22" width="492" height="168" rx="26" fill="url(#screenGrad)"/>

    <!-- Screen Emerald Header Bar (Active Sale Indicator) -->
    <rect x="-220" y="2" width="440" height="38" rx="12" fill="url(#emeraldGrad)"/>
    <circle cx="-190" cy="21" r="8" fill="#FFFFFF"/>
    <rect x="-170" y="14" width="110" height="14" rx="7" fill="#FFFFFF" opacity="0.95"/>
    <circle cx="190" cy="21" r="8" fill="url(#goldGrad)"/>

    <!-- Minimalist Keypad / Action Indicators (Uncluttered) -->
    <rect x="-220" y="60" width="85" height="66" rx="16" fill="#0F172A"/>
    <circle cx="-177" cy="93" r="15" fill="#38BDF8"/>

    <rect x="-118" y="60" width="85" height="66" rx="16" fill="#0F172A"/>
    <circle cx="-75" cy="93" r="15" fill="url(#goldGrad)"/>

    <!-- Emerald Pay / Check Action Button -->
    <rect x="-16" y="60" width="236" height="66" rx="16" fill="url(#emeraldGrad)"/>
    <path d="M70,93 L92,112 L142,72" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Currency sign on button -->
    <text x="18" y="103" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" letter-spacing="1">CUP</text>
  </g>
</svg>
`;

// 2. Android Adaptive Icon Foreground SVG (Transparent background, centered in safe 66% area)
const adaptiveIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
  </defs>

  <!-- GLYPH GROUP SCALED TO SAFE ZONE (80% scale centered at 512,512) -->
  <g transform="translate(512, 512) scale(0.82)">
    <!-- 1. Receipt / Ticket -->
    <g transform="translate(0, -145)">
      <path d="M-150,-160 L150,-160 L150,110 L100,85 L50,110 L0,85 L-50,110 L-100,85 L-150,110 Z" fill="#F8FAFC"/>
      <rect x="-115" y="-125" width="125" height="18" rx="9" fill="url(#goldGrad)"/>
      <circle cx="95" cy="-116" r="14" fill="url(#goldGrad)"/>
      <rect x="-115" y="-85" width="230" height="14" rx="7" fill="#94A3B8" opacity="0.8"/>
      <rect x="-115" y="-55" width="160" height="14" rx="7" fill="#CBD5E1" opacity="0.8"/>
      <rect x="-115" y="-18" width="230" height="36" rx="12" fill="url(#emeraldGrad)"/>
      <rect x="-90" y="-7" width="80" height="14" rx="7" fill="#FFFFFF"/>
      <circle cx="75" cy="0" r="7" fill="#FFFFFF"/>
      <circle cx="95" cy="0" r="7" fill="#FFFFFF"/>
    </g>

    <!-- 2. Base Platform Shadow -->
    <rect x="-240" y="240" width="480" height="40" rx="20" fill="#000000" opacity="0.6"/>
    
    <!-- 3. Cash Drawer -->
    <rect x="-230" y="140" width="460" height="115" rx="30" fill="#1E293B" stroke="#334155" stroke-width="8"/>
    <rect x="-110" y="190" width="220" height="16" rx="8" fill="#0B1120"/>
    <circle cx="130" cy="198" r="9" fill="url(#goldGrad)"/>

    <!-- 4. Terminal Main Body -->
    <rect x="-270" y="-45" width="540" height="215" rx="36" fill="#0B1120" stroke="#334155" stroke-width="10"/>
    <rect x="-246" y="-22" width="492" height="168" rx="26" fill="url(#screenGrad)"/>

    <!-- Screen Header -->
    <rect x="-220" y="2" width="440" height="38" rx="12" fill="url(#emeraldGrad)"/>
    <circle cx="-190" cy="21" r="8" fill="#FFFFFF"/>
    <rect x="-170" y="14" width="110" height="14" rx="7" fill="#FFFFFF" opacity="0.95"/>
    <circle cx="190" cy="21" r="8" fill="url(#goldGrad)"/>

    <!-- Keypad -->
    <rect x="-220" y="60" width="85" height="66" rx="16" fill="#0F172A"/>
    <circle cx="-177" cy="93" r="15" fill="#38BDF8"/>

    <rect x="-118" y="60" width="85" height="66" rx="16" fill="#0F172A"/>
    <circle cx="-75" cy="93" r="15" fill="url(#goldGrad)"/>

    <!-- Action Button -->
    <rect x="-16" y="60" width="236" height="66" rx="16" fill="url(#emeraldGrad)"/>
    <path d="M70,93 L92,112 L142,72" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="18" y="103" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" letter-spacing="1">CUP</text>
  </g>
</svg>
`;

// 3. Splash Icon SVG (512x512 / 1024x1024 centered for splash screens)
const splashIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
  </defs>

  <g transform="translate(512, 480) scale(0.92)">
    <g transform="translate(0, -145)">
      <path d="M-150,-160 L150,-160 L150,110 L100,85 L50,110 L0,85 L-50,110 L-100,85 L-150,110 Z" fill="#F8FAFC"/>
      <rect x="-115" y="-125" width="125" height="18" rx="9" fill="url(#goldGrad)"/>
      <circle cx="95" cy="-116" r="14" fill="url(#goldGrad)"/>
      <rect x="-115" y="-85" width="230" height="14" rx="7" fill="#94A3B8" opacity="0.8"/>
      <rect x="-115" y="-55" width="160" height="14" rx="7" fill="#CBD5E1" opacity="0.8"/>
      <rect x="-115" y="-18" width="230" height="36" rx="12" fill="url(#emeraldGrad)"/>
      <rect x="-90" y="-7" width="80" height="14" rx="7" fill="#FFFFFF"/>
      <circle cx="75" cy="0" r="7" fill="#FFFFFF"/>
      <circle cx="95" cy="0" r="7" fill="#FFFFFF"/>
    </g>

    <rect x="-240" y="240" width="480" height="40" rx="20" fill="#000000" opacity="0.6"/>
    <rect x="-230" y="140" width="460" height="115" rx="30" fill="#1E293B" stroke="#334155" stroke-width="8"/>
    <rect x="-110" y="190" width="220" height="16" rx="8" fill="#0B1120"/>
    <circle cx="130" cy="198" r="9" fill="url(#goldGrad)"/>

    <rect x="-270" y="-45" width="540" height="215" rx="36" fill="#0B1120" stroke="#334155" stroke-width="10"/>
    <rect x="-246" y="-22" width="492" height="168" rx="26" fill="url(#screenGrad)"/>

    <rect x="-220" y="2" width="440" height="38" rx="12" fill="url(#emeraldGrad)"/>
    <circle cx="-190" cy="21" r="8" fill="#FFFFFF"/>
    <rect x="-170" y="14" width="110" height="14" rx="7" fill="#FFFFFF" opacity="0.95"/>
    <circle cx="190" cy="21" r="8" fill="url(#goldGrad)"/>

    <rect x="-220" y="60" width="85" height="66" rx="16" fill="#0F172A"/>
    <circle cx="-177" cy="93" r="15" fill="#38BDF8"/>

    <rect x="-118" y="60" width="85" height="66" rx="16" fill="#0F172A"/>
    <circle cx="-75" cy="93" r="15" fill="url(#goldGrad)"/>

    <rect x="-16" y="60" width="236" height="66" rx="16" fill="url(#emeraldGrad)"/>
    <path d="M70,93 L92,112 L142,72" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="18" y="103" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" letter-spacing="1">CUP</text>
  </g>
</svg>
`;

// 4. High-contrast Favicon SVG (Compact, clean geometric for 16px/32px/48px)
const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="24" fill="#0F172A"/>
  <!-- Top Ticket -->
  <path d="M30 14 H70 V40 L63 36 L56 40 L50 36 L44 40 L37 36 L30 40 Z" fill="#F8FAFC"/>
  <rect x="36" y="20" width="28" height="4" rx="2" fill="#F59E0B"/>
  <rect x="36" y="27" width="20" height="3" rx="1.5" fill="#94A3B8"/>
  <rect x="36" y="32" width="28" height="5" rx="2.5" fill="#10B981"/>
  <!-- Register Body -->
  <rect x="14" y="44" width="72" height="34" rx="8" fill="#1E293B" stroke="#334155" stroke-width="3"/>
  <rect x="22" y="50" width="56" height="10" rx="4" fill="#10B981"/>
  <!-- Stand & Button -->
  <rect x="20" y="78" width="60" height="10" rx="4" fill="#0F172A"/>
  <circle cx="68" cy="68" r="5" fill="#F59E0B"/>
  <rect x="22" y="65" width="16" height="6" rx="2" fill="#38BDF8"/>
  <rect x="42" y="65" width="16" height="6" rx="2" fill="#10B981"/>
</svg>
`;

async function generateAllAssets() {
  const publicDir = path.join(process.cwd(), 'public');
  const assetsDir = path.join(process.cwd(), 'assets');
  const androidResDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');
  
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  console.log("🎨 Writing SVG icon source files...");
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'adaptive-icon.svg'), adaptiveIconSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'splash-icon.svg'), splashIconSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg.trim());

  fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg.trim());
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), adaptiveIconSvg.trim());
  fs.writeFileSync(path.join(assetsDir, 'splash-icon.svg'), splashIconSvg.trim());
  fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), faviconSvg.trim());

  console.log("⚡ Generating Web / PWA PNG Icons...");

  // 1. icon.png (1024x1024)
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon.png'));
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'icon.png'));

  // 2. adaptive-icon.png (1024x1024 transparent foreground)
  await sharp(Buffer.from(adaptiveIconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'adaptive-icon.png'));
  await sharp(Buffer.from(adaptiveIconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));

  // 3. splash-icon.png (1024x1024 and 512x512)
  await sharp(Buffer.from(splashIconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'splash-icon.png'));
  await sharp(Buffer.from(splashIconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'splash-icon.png'));

  // 4. Favicons
  await sharp(Buffer.from(faviconSvg))
    .resize(48, 48)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon.png'));
  await sharp(Buffer.from(faviconSvg))
    .resize(48, 48)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'favicon.png'));

  await sharp(Buffer.from(faviconSvg))
    .resize(32, 32)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(Buffer.from(faviconSvg))
    .resize(16, 16)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon-16x16.png'));

  // 5. Apple Touch Icon (180x180)
  await sharp(Buffer.from(iconSvg))
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(Buffer.from(iconSvg))
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'apple-touch-icon.png'));

  // 6. Chrome PWA icons (192x192 & 512x512)
  await sharp(Buffer.from(iconSvg))
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'android-chrome-192x192.png'));
  await sharp(Buffer.from(iconSvg))
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'android-chrome-512x512.png'));

  // --- Android Native Launcher & Splash Icons in android/app/src/main/res ---
  if (fs.existsSync(androidResDir)) {
    console.log("📱 Generating Android Native APK launcher and splash icons...");

    const densities = [
      { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
      { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
      { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
      { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
      { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
    ];

    for (const d of densities) {
      const dirPath = path.join(androidResDir, d.name);
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

      // Standard square/squircle ic_launcher.png
      await sharp(Buffer.from(iconSvg))
        .resize(d.size, d.size)
        .png({ quality: 100 })
        .toFile(path.join(dirPath, 'ic_launcher.png'));

      // Round ic_launcher_round.png
      const roundedMask = Buffer.from(
        `<svg width="${d.size}" height="${d.size}"><circle cx="${d.size / 2}" cy="${d.size / 2}" r="${d.size / 2}" fill="#fff"/></svg>`
      );
      const iconResized = await sharp(Buffer.from(iconSvg)).resize(d.size, d.size).toBuffer();
      await sharp(iconResized)
        .composite([{ input: roundedMask, blend: 'dest-in' }])
        .png({ quality: 100 })
        .toFile(path.join(dirPath, 'ic_launcher_round.png'));

      // Adaptive Foreground ic_launcher_foreground.png
      await sharp(Buffer.from(adaptiveIconSvg))
        .resize(d.fgSize, d.fgSize)
        .png({ quality: 100 })
        .toFile(path.join(dirPath, 'ic_launcher_foreground.png'));
    }

    // Splash drawables (Portrait & Landscape)
    const splashDrawables = [
      { dir: 'drawable', w: 480, h: 800 },
      { dir: 'drawable-port-mdpi', w: 320, h: 480 },
      { dir: 'drawable-port-hdpi', w: 480, h: 800 },
      { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
      { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
      { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
      { dir: 'drawable-land-mdpi', w: 480, h: 320 },
      { dir: 'drawable-land-hdpi', w: 800, h: 480 },
      { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
      { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
      { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
    ];

    for (const s of splashDrawables) {
      const splashDir = path.join(androidResDir, s.dir);
      if (fs.existsSync(splashDir)) {
        // Render splash with #0F172A background and centered icon
        const iconSize = Math.min(Math.round(Math.min(s.w, s.h) * 0.42), 360);
        const iconBuffer = await sharp(Buffer.from(iconSvg)).resize(iconSize, iconSize).toBuffer();
        
        await sharp({
          create: {
            width: s.w,
            height: s.h,
            channels: 4,
            background: { r: 15, g: 23, b: 42, alpha: 1 } // #0F172A
          }
        })
          .composite([{ input: iconBuffer, gravity: 'center' }])
          .png({ quality: 100 })
          .toFile(path.join(splashDir, 'splash.png'));
      }
    }

    // Update ic_launcher_background.xml
    const valuesDir = path.join(androidResDir, 'values');
    if (fs.existsSync(valuesDir)) {
      const backgroundXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0F172A</color>
</resources>
`;
      fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), backgroundXmlContent.trim());
    }

    const drawableDir = path.join(androidResDir, 'drawable');
    if (fs.existsSync(drawableDir)) {
      const drawableBgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportHeight="108"
    android:viewportWidth="108">
    <path
        android:fillColor="#0F172A"
        android:pathData="M0,0h108v108h-108z" />
</vector>
`;
      fs.writeFileSync(path.join(drawableDir, 'ic_launcher_background.xml'), drawableBgXmlContent.trim());
    }
  }

  console.log("✅ All APK & PWA launcher and splash icons generated successfully!");
}

generateAllAssets().catch(err => {
  console.error("❌ Error generating icons:", err);
  process.exit(1);
});
