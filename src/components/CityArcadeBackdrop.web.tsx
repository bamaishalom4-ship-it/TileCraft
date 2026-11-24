import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Original 16-bit pixel-art city street scene for the TileCraft home hero.
 * Features a teal skyline, quiet sunset clouds, warm storefront windows,
 * and a twilight city curb. Static and crisp (no flashing or heavy scanlines).
 */
export const CityArcadeBackdrop: React.FC = () => {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <svg
        viewBox="0 0 240 168"
        preserveAspectRatio="xMidYMax slice"
        width="100%"
        height="100%"
        shapeRendering="crispEdges"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        {/* Stepped 16-bit Teal-to-Sunset Sky Bands */}
        <rect x="0" y="0" width="240" height="44" fill="#1A535E" />
        <rect x="0" y="44" width="240" height="28" fill="#257F8C" />
        <rect x="0" y="72" width="240" height="18" fill="#3B919A" />
        <rect x="0" y="90" width="240" height="12" fill="#9AA99E" />
        <rect x="0" y="102" width="240" height="12" fill="#E3AE89" />
        <rect x="0" y="114" width="240" height="10" fill="#F3B78E" />

        {/* Quiet Pixel Sunset Clouds */}
        {/* Left cloud */}
        <rect x="10" y="52" width="38" height="4" fill="#F3B78E" />
        <rect x="16" y="49" width="24" height="3" fill="#FFF0D0" />
        <rect x="6" y="56" width="46" height="3" fill="#B67C7A" />
        <rect x="14" y="59" width="28" height="2" fill="#725C76" />

        {/* Right cloud */}
        <rect x="184" y="46" width="44" height="4" fill="#F3B78E" />
        <rect x="192" y="43" width="26" height="3" fill="#FFF0D0" />
        <rect x="178" y="50" width="54" height="3" fill="#B67C7A" />
        <rect x="190" y="53" width="32" height="2" fill="#725C76" />

        {/* Small center horizon cloud */}
        <rect x="94" y="66" width="36" height="3" fill="#F3B78E" />
        <rect x="100" y="64" width="20" height="2" fill="#FFF0D0" />
        <rect x="88" y="69" width="44" height="2" fill="#725C76" />

        {/* Distant Skyline Silhouettes (Dusty Blue & Muted Mauve) */}
        <rect x="4" y="68" width="22" height="58" fill="#325769" />
        <rect x="8" y="64" width="12" height="4" fill="#325769" />
        <rect x="30" y="76" width="26" height="50" fill="#465D75" />
        <rect x="62" y="62" width="24" height="64" fill="#375166" />
        <rect x="112" y="70" width="28" height="56" fill="#4B4F6A" />
        <rect x="150" y="58" width="24" height="68" fill="#345668" />
        <rect x="159" y="50" width="2" height="8" fill="#161820" />
        <rect x="155" y="54" width="10" height="4" fill="#345668" />
        <rect x="186" y="72" width="26" height="54" fill="#51465F" />
        <rect x="216" y="66" width="24" height="60" fill="#325466" />

        {/* Distant tiny lit windows */}
        <rect x="10" y="74" width="2" height="2" fill="#FFF0D0" />
        <rect x="16" y="80" width="2" height="2" fill="#FFBE55" />
        <rect x="68" y="70" width="2" height="2" fill="#FFF0D0" />
        <rect x="74" y="76" width="2" height="2" fill="#FFBE55" />
        <rect x="156" y="66" width="2" height="2" fill="#FFF0D0" />
        <rect x="162" y="72" width="2" height="2" fill="#FFBE55" />
        <rect x="194" y="78" width="2" height="2" fill="#FFF0D0" />
        <rect x="222" y="74" width="2" height="2" fill="#FFBE55" />

        {/* Midground Pixel Towers with Crisp Ink Outlines */}
        {/* Left-center tower */}
        <rect x="22" y="82" width="32" height="46" fill="#161820" />
        <rect x="24" y="84" width="28" height="44" fill="#234857" />
        <rect x="24" y="84" width="10" height="44" fill="#2C5E6E" />
        {[88, 94, 100, 106].map((wy) => (
          <React.Fragment key={`t1-${wy}`}>
            <rect x="28" y={wy} width="4" height="3" fill="#FFBE55" />
            <rect x="35" y={wy} width="4" height="3" fill={wy === 94 ? '#161820' : '#FFF0D0'} />
            <rect x="42" y={wy} width="4" height="3" fill={wy === 100 ? '#FF8A16' : '#1B2D38'} />
          </React.Fragment>
        ))}

        {/* Tall center office tower */}
        <rect x="82" y="66" width="36" height="62" fill="#161820" />
        <rect x="84" y="68" width="32" height="60" fill="#2A3E52" />
        <rect x="84" y="68" width="12" height="60" fill="#37536A" />
        <rect x="94" y="62" width="12" height="4" fill="#161820" />
        <rect x="96" y="64" width="8" height="2" fill="#725C76" />
        {[72, 78, 84, 90, 96, 102].map((wy) => (
          <React.Fragment key={`t2-${wy}`}>
            <rect x="88" y={wy} width="3" height="3" fill={wy % 12 === 0 ? '#FFF0D0' : '#1A2433'} />
            <rect x="94" y={wy} width="3" height="3" fill={wy === 84 ? '#FF8A16' : '#FFBE55'} />
            <rect x="100" y={wy} width="3" height="3" fill={wy === 78 ? '#1A2433' : '#FFF0D0'} />
            <rect x="106" y={wy} width="3" height="3" fill={wy === 96 ? '#FFBE55' : '#1A2433'} />
          </React.Fragment>
        ))}

        {/* Right-center twilight tower */}
        <rect x="166" y="76" width="34" height="52" fill="#161820" />
        <rect x="168" y="78" width="30" height="50" fill="#3B344D" />
        <rect x="168" y="78" width="10" height="50" fill="#524666" />
        {[82, 88, 94, 100, 106].map((wy) => (
          <React.Fragment key={`t3-${wy}`}>
            <rect x="172" y={wy} width="4" height="3" fill={wy === 88 ? '#FF8A16' : '#FFBE55'} />
            <rect x="180" y={wy} width="4" height="3" fill={wy === 100 ? '#161820' : '#FFF0D0'} />
            <rect x="188" y={wy} width="4" height="3" fill={wy === 82 ? '#FFF0D0' : '#252136'} />
          </React.Fragment>
        ))}

        {/* Foreground Storefront Row (Brick Red, Faded Teal & Dusty Mauve) */}
        {/* Left Brick Storefront */}
        <rect x="0" y="112" width="76" height="34" fill="#161820" />
        <rect x="2" y="114" width="72" height="32" fill="#B74A3C" />
        <rect x="2" y="114" width="72" height="4" fill="#822F26" />
        {/* Brick texture dashes */}
        <rect x="8" y="120" width="6" height="2" fill="#9A3B2F" />
        <rect x="52" y="120" width="8" height="2" fill="#9A3B2F" />
        {/* Striped awning */}
        <rect x="6" y="124" width="60" height="6" fill="#161820" />
        {[8, 20, 32, 44, 56].map((ax) => (
          <rect key={`aw-${ax}`} x={ax} y="125" width="6" height="4" fill="#FFF0D0" />
        ))}
        {[14, 26, 38, 50].map((ax) => (
          <rect key={`aw2-${ax}`} x={ax} y="125" width="6" height="4" fill="#FF8A16" />
        ))}
        {/* Warm storefront window */}
        <rect x="10" y="130" width="38" height="14" fill="#161820" />
        <rect x="12" y="132" width="34" height="12" fill="#FFBE55" />
        <rect x="14" y="133" width="12" height="10" fill="#FFF0D0" />
        <rect x="30" y="133" width="14" height="10" fill="#FF8A16" />
        <rect x="28" y="132" width="2" height="12" fill="#161820" />
        {/* Shop doorway */}
        <rect x="52" y="130" width="14" height="16" fill="#161820" />
        <rect x="54" y="132" width="10" height="12" fill="#3B2B33" />
        <rect x="56" y="134" width="6" height="5" fill="#FFF0D0" />

        {/* Center Teal Arcade Storefront */}
        <rect x="76" y="106" width="88" height="40" fill="#161820" />
        <rect x="78" y="108" width="84" height="38" fill="#257F8C" />
        <rect x="78" y="108" width="84" height="4" fill="#1A535E" />
        {/* Mini 2x2 Tile Icon Marquee Sign */}
        <rect x="96" y="113" width="48" height="12" fill="#161820" />
        <rect x="98" y="115" width="44" height="8" fill="#2B3046" />
        <rect x="102" y="117" width="4" height="4" fill="#FFF0D0" />
        <rect x="108" y="117" width="4" height="4" fill="#FF8A16" />
        <rect x="114" y="117" width="4" height="4" fill="#FFF0D0" />
        <rect x="122" y="118" width="16" height="2" fill="#FFBE55" />
        {/* Big Warm Arcade Windows */}
        <rect x="84" y="128" width="28" height="16" fill="#161820" />
        <rect x="86" y="130" width="24" height="12" fill="#FFF0D0" />
        <rect x="86" y="137" width="24" height="5" fill="#FFBE55" />
        <rect x="128" y="128" width="28" height="16" fill="#161820" />
        <rect x="130" y="130" width="24" height="12" fill="#FFF0D0" />
        <rect x="130" y="137" width="24" height="5" fill="#FFBE55" />
        {/* Center Entrance */}
        <rect x="114" y="128" width="12" height="18" fill="#161820" />
        <rect x="116" y="130" width="8" height="14" fill="#FF8A16" />
        <rect x="118" y="132" width="4" height="6" fill="#FFF0D0" />

        {/* Right Dusty Mauve Corner Shop */}
        <rect x="164" y="114" width="76" height="32" fill="#161820" />
        <rect x="166" y="116" width="72" height="30" fill="#725C76" />
        <rect x="166" y="116" width="72" height="4" fill="#524157" />
        {/* Corner warm sign */}
        <rect x="172" y="122" width="26" height="6" fill="#161820" />
        <rect x="174" y="124" width="22" height="2" fill="#F3B78E" />
        {/* Warm shop windows */}
        <rect x="172" y="130" width="24" height="14" fill="#161820" />
        <rect x="174" y="132" width="20" height="10" fill="#FFBE55" />
        <rect x="176" y="133" width="8" height="8" fill="#FFF0D0" />
        <rect x="202" y="130" width="30" height="14" fill="#161820" />
        <rect x="204" y="132" width="26" height="10" fill="#FF8A16" />
        <rect x="206" y="133" width="12" height="8" fill="#FFBE55" />

        {/* Pixel Streetlamp Silhouettes + Warm Glow */}
        <rect x="73" y="106" width="2" height="42" fill="#161820" />
        <rect x="70" y="104" width="8" height="4" fill="#161820" />
        <rect x="72" y="105" width="4" height="2" fill="#FFF0D0" />
        <rect x="163" y="106" width="2" height="42" fill="#161820" />
        <rect x="160" y="104" width="8" height="4" fill="#161820" />
        <rect x="162" y="105" width="4" height="2" fill="#FFF0D0" />

        {/* Sidewalk, Curb & Quiet Twilight Street */}
        <rect x="0" y="146" width="240" height="4" fill="#C9B99F" />
        <rect x="0" y="150" width="240" height="2" fill="#161820" />
        <rect x="0" y="152" width="240" height="16" fill="#232638" />
        {/* Subtle warm storefront light spill on sidewalk */}
        <rect x="12" y="146" width="34" height="3" fill="#F3B78E" />
        <rect x="86" y="146" width="68" height="3" fill="#FFF0D0" />
        <rect x="174" y="146" width="56" height="3" fill="#F3B78E" />
        {/* Crisp dashed lane markers */}
        <rect x="16" y="159" width="22" height="2" fill="#EAD8B4" />
        <rect x="64" y="159" width="22" height="2" fill="#EAD8B4" />
        <rect x="112" y="159" width="22" height="2" fill="#EAD8B4" />
        <rect x="160" y="159" width="22" height="2" fill="#EAD8B4" />
        <rect x="206" y="159" width="20" height="2" fill="#EAD8B4" />
      </svg>
    </View>
  );
};
