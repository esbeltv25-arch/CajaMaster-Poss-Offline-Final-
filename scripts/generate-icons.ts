import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// --- Vector SVGs designed strictly to specifications ---

// 1. Full App Icon SVG (1024x1024)
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>

  <!-- Background Base #0F172A -->
  <rect width="1024" height="1024" rx="224" fill="url(#bgGrad)"/>
  
  <!-- Subtle inner ambient border -->
  <rect x="16" y="16" width="992" height="992" rx="208" fill="none" stroke="#334155" stroke-width="4" opacity="0.3"/>

  <!-- GLYPH GROUP (Centered within 66% safe area: 512,512) -->
  <g transform="translate(512, 512)">
    
    <!-- Receipt Ticket emerging upwards -->
    <g transform="translate(0, -130)">
      <!-- Ticket Body -->
      <path d="M-150,-170 L150,-170 L150,110 L100,90 L50,110 L0,90 L-50,110 L-100,90 L-150,110 Z" fill="#F8FAFC"/>
      
      <!-- Receipt Lines & Details -->
      <!-- Golden Header Line -->
      <rect x="-110" y="-135" width="140" height="18" rx="9" fill="url(#goldGrad)"/>
      <circle cx="90" cy="-126" r="14" fill="url(#goldGrad)"/>
      
      <!-- Content Lines in soft slate -->
      <rect x="-110" y="-95" width="220" height="12" rx="6" fill="#94A3B8" opacity="0.8"/>
      <rect x="-110" y="-65" width="160" height="12" rx="6" fill="#CBD5E1" opacity="0.8"/>
      <rect x="-110" y="-35" width="200" height="12" rx="6" fill="#CBD5E1" opacity="0.8"/>
      
      <!-- Emerald Total Pill Badge inside receipt -->
      <rect x="-110" y="0" width="220" height="34" rx="10" fill="url(#emeraldGrad)"/>
      <rect x="-85" y="11" width="70" height="12" rx="6" fill="#FFFFFF"/>
      <circle cx="70" cy="17" r="6" fill="#FFFFFF"/>
      <circle cx="88" cy="17" r="6" fill="#FFFFFF"/>
    </g>

    <!-- POS Terminal / Register Screen & Body -->
    <!-- Base Shadow/Platform -->
    <rect x="-240" y="240" width="480" height="42" rx="21" fill="#090D16" opacity="0.7"/>
    
    <!-- Cash Register Stand / Drawer Base -->
    <rect x="-220" y="140" width="440" height="110" rx="28" fill="#1E293B" stroke="#334155" stroke-width="8"/>
    
    <!-- Cash Drawer Handle / Slot -->
    <rect x="-90" y="190" width="180" height="16" rx="8" fill="#0F172A"/>
    <circle cx="120" cy="198" r="8" fill="url(#goldGrad)"/>

    <!-- Terminal Main Body / Screen Frame -->
    <rect x="-260" y="-40" width="520" height="200" rx="32" fill="#0F172A" stroke="#334155" stroke-width="10"/>
    
    <!-- Terminal Screen Glass -->
    <rect x="-236" y="-16" width="472" height="152" rx="22" fill="#1E293B"/>

    <!-- Screen Emerald Header Bar (Active POS Indicator) -->
    <rect x="-212" y="8" width="424" height="34" rx="10" fill="url(#emeraldGrad)"/>
    <circle cx="-185" cy="25" r="7" fill="#FFFFFF"/>
    <rect x="-165" y="19" width="90" height="12" rx="6" fill="#FFFFFF" opacity="0.9"/>
    
    <!-- Golden Status / Live Sale Symbol -->
    <circle cx="180" cy="25" r="8" fill="url(#goldGrad)"/>

    <!-- Screen Sales Matrix / Keypad Indicators -->
    <rect x="-212" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="-172" cy="88" r="14" fill="#38BDF8" opacity="0.9"/>

    <rect x="-116" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="-76" cy="88" r="14" fill="url(#emeraldGrad)"/>

    <rect x="-20" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="20" cy="88" r="14" fill="url(#goldGrad)"/>

    <rect x="76" y="58" width="136" height="60" rx="12" fill="url(#emeraldGrad)"/>
    <!-- Checkmark on Pay / Enter button -->
    <path d="M124,88 L138,102 L168,72" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;

// 2. Android Adaptive Icon Foreground SVG (1024x1024, Transparent, Centered within safe zone 66%)
const adaptiveIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>

  <!-- GLYPH GROUP SCALED TO 85% OF CENTER SAFE CIRCLE -->
  <g transform="translate(512, 512) scale(0.85)">
    <!-- Receipt Ticket -->
    <g transform="translate(0, -130)">
      <path d="M-150,-170 L150,-170 L150,110 L100,90 L50,110 L0,90 L-50,110 L-100,90 L-150,110 Z" fill="#F8FAFC"/>
      <rect x="-110" y="-135" width="140" height="18" rx="9" fill="url(#goldGrad)"/>
      <circle cx="90" cy="-126" r="14" fill="url(#goldGrad)"/>
      <rect x="-110" y="-95" width="220" height="12" rx="6" fill="#94A3B8" opacity="0.8"/>
      <rect x="-110" y="-65" width="160" height="12" rx="6" fill="#CBD5E1" opacity="0.8"/>
      <rect x="-110" y="-35" width="200" height="12" rx="6" fill="#CBD5E1" opacity="0.8"/>
      <rect x="-110" y="0" width="220" height="34" rx="10" fill="url(#emeraldGrad)"/>
      <rect x="-85" y="11" width="70" height="12" rx="6" fill="#FFFFFF"/>
      <circle cx="70" cy="17" r="6" fill="#FFFFFF"/>
      <circle cx="88" cy="17" r="6" fill="#FFFFFF"/>
    </g>

    <!-- Cash Register Stand -->
    <rect x="-240" y="240" width="480" height="42" rx="21" fill="#090D16" opacity="0.7"/>
    <rect x="-220" y="140" width="440" height="110" rx="28" fill="#1E293B" stroke="#334155" stroke-width="8"/>
    <rect x="-90" y="190" width="180" height="16" rx="8" fill="#0F172A"/>
    <circle cx="120" cy="198" r="8" fill="url(#goldGrad)"/>

    <!-- Terminal Main Body -->
    <rect x="-260" y="-40" width="520" height="200" rx="32" fill="#0F172A" stroke="#334155" stroke-width="10"/>
    <rect x="-236" y="-16" width="472" height="152" rx="22" fill="#1E293B"/>

    <!-- Screen Header -->
    <rect x="-212" y="8" width="424" height="34" rx="10" fill="url(#emeraldGrad)"/>
    <circle cx="-185" cy="25" r="7" fill="#FFFFFF"/>
    <rect x="-165" y="19" width="90" height="12" rx="6" fill="#FFFFFF" opacity="0.9"/>
    <circle cx="180" cy="25" r="8" fill="url(#goldGrad)"/>

    <!-- Matrix -->
    <rect x="-212" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="-172" cy="88" r="14" fill="#38BDF8" opacity="0.9"/>

    <rect x="-116" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="-76" cy="88" r="14" fill="url(#emeraldGrad)"/>

    <rect x="-20" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="20" cy="88" r="14" fill="url(#goldGrad)"/>

    <rect x="76" y="58" width="136" height="60" rx="12" fill="url(#emeraldGrad)"/>
    <path d="M124,88 L138,102 L168,72" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;

// 3. Splash Icon SVG (512x512 / 1024x1024 for Splash Screen centering)
const splashIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>

  <g transform="translate(512, 490) scale(0.95)">
    <!-- Receipt Ticket -->
    <g transform="translate(0, -130)">
      <path d="M-150,-170 L150,-170 L150,110 L100,90 L50,110 L0,90 L-50,110 L-100,90 L-150,110 Z" fill="#F8FAFC"/>
      <rect x="-110" y="-135" width="140" height="18" rx="9" fill="url(#goldGrad)"/>
      <circle cx="90" cy="-126" r="14" fill="url(#goldGrad)"/>
      <rect x="-110" y="-95" width="220" height="12" rx="6" fill="#94A3B8" opacity="0.8"/>
      <rect x="-110" y="-65" width="160" height="12" rx="6" fill="#CBD5E1" opacity="0.8"/>
      <rect x="-110" y="-35" width="200" height="12" rx="6" fill="#CBD5E1" opacity="0.8"/>
      <rect x="-110" y="0" width="220" height="34" rx="10" fill="url(#emeraldGrad)"/>
      <rect x="-85" y="11" width="70" height="12" rx="6" fill="#FFFFFF"/>
      <circle cx="70" cy="17" r="6" fill="#FFFFFF"/>
      <circle cx="88" cy="17" r="6" fill="#FFFFFF"/>
    </g>

    <!-- Cash Register Stand -->
    <rect x="-240" y="240" width="480" height="42" rx="21" fill="#090D16" opacity="0.7"/>
    <rect x="-220" y="140" width="440" height="110" rx="28" fill="#1E293B" stroke="#334155" stroke-width="8"/>
    <rect x="-90" y="190" width="180" height="16" rx="8" fill="#0F172A"/>
    <circle cx="120" cy="198" r="8" fill="url(#goldGrad)"/>

    <!-- Terminal Main Body -->
    <rect x="-260" y="-40" width="520" height="200" rx="32" fill="#0F172A" stroke="#334155" stroke-width="10"/>
    <rect x="-236" y="-16" width="472" height="152" rx="22" fill="#1E293B"/>

    <!-- Screen Header -->
    <rect x="-212" y="8" width="424" height="34" rx="10" fill="url(#emeraldGrad)"/>
    <circle cx="-185" cy="25" r="7" fill="#FFFFFF"/>
    <rect x="-165" y="19" width="90" height="12" rx="6" fill="#FFFFFF" opacity="0.9"/>
    <circle cx="180" cy="25" r="8" fill="url(#goldGrad)"/>

    <!-- Matrix -->
    <rect x="-212" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="-172" cy="88" r="14" fill="#38BDF8" opacity="0.9"/>

    <rect x="-116" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="-76" cy="88" r="14" fill="url(#emeraldGrad)"/>

    <rect x="-20" y="58" width="80" height="60" rx="12" fill="#0F172A"/>
    <circle cx="20" cy="88" r="14" fill="url(#goldGrad)"/>

    <rect x="76" y="58" width="136" height="60" rx="12" fill="url(#emeraldGrad)"/>
    <path d="M124,88 L138,102 L168,72" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;

// 4. High-contrast Favicon SVG (32x32 / 48x48)
const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="24" fill="#0F172A"/>
  <!-- Ticket -->
  <path d="M30 14 H70 V42 L63 38 L56 42 L50 38 L44 42 L37 38 L30 42 Z" fill="#F8FAFC"/>
  <rect x="36" y="20" width="28" height="4" rx="2" fill="#F59E0B"/>
  <rect x="36" y="27" width="20" height="3" rx="1.5" fill="#94A3B8"/>
  <rect x="36" y="33" width="28" height="5" rx="2.5" fill="#10B981"/>
  <!-- Register Body -->
  <rect x="14" y="44" width="72" height="34" rx="8" fill="#1E293B" stroke="#334155" stroke-width="3"/>
  <rect x="22" y="50" width="56" height="10" rx="4" fill="#10B981"/>
  <!-- Stand & Button -->
  <rect x="20" y="78" width="60" height="10" rx="4" fill="#0F172A"/>
  <circle cx="68" cy="68" r="5" fill="#F59E0B"/>
  <rect x="22" y="65" width="14" height="6" rx="2" fill="#38BDF8"/>
  <rect x="42" y="65" width="14" height="6" rx="2" fill="#10B981"/>
</svg>
`;

async function generateAllAssets() {
  const publicDir = path.join(process.cwd(), 'public');
  const assetsDir = path.join(process.cwd(), 'assets');
  
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  console.log("🎨 Rendering SVG files...");
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'adaptive-icon.svg'), adaptiveIconSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'splash-icon.svg'), splashIconSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg.trim());

  fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg.trim());
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), adaptiveIconSvg.trim());
  fs.writeFileSync(path.join(assetsDir, 'splash-icon.svg'), splashIconSvg.trim());
  fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), faviconSvg.trim());

  console.log("⚡ Rasterizing crisp PNG icons via sharp...");

  // 1. icon.png (1024x1024)
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon.png'));
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'icon.png'));

  // 2. adaptive-icon.png (1024x1024 transparent foreground for Android)
  await sharp(Buffer.from(adaptiveIconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'adaptive-icon.png'));
  await sharp(Buffer.from(adaptiveIconSvg))
    .resize(1024, 1024)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));

  // 3. splash-icon.png (1024x1024 and 512x512 transparent for Splash Screen)
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

  console.log("✅ All icon assets generated successfully!");
}

generateAllAssets().catch(err => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
