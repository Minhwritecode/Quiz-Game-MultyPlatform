import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  BRAND,
  beatSpring,
  drosteTunnelTransform,
  kineticReveal,
  portalZoomCurve,
} from './shotcraft/recipes';

const CHAOS_DOCS = [
  { label: 'PDF · 184 trang', lines: 5, angle: -24, radius: 195, phaseOffset: 0.06, accent: BRAND.indigoBright },
  { label: 'Slide Chương 7', lines: 4, angle: 34, radius: 220, phaseOffset: 0.18, accent: BRAND.violet },
  { label: 'Ảnh chụp bảng', lines: 3, angle: 95, radius: 205, phaseOffset: 0.31, accent: BRAND.rose },
  { label: 'Đề cương thi', lines: 5, angle: 152, radius: 215, phaseOffset: 0.44, accent: BRAND.amber },
  { label: 'Ghi chú rời rạc', lines: 4, angle: 212, radius: 190, phaseOffset: 0.58, accent: BRAND.magenta },
  { label: 'Tài liệu ôn gấp', lines: 5, angle: 274, radius: 210, phaseOffset: 0.72, accent: BRAND.periwinkle },
  { label: '120 câu trắc nghiệm', lines: 4, angle: 325, radius: 200, phaseOffset: 0.85, accent: BRAND.gold },
];

const FEATURE_CARDS = [
  {
    step: '01',
    badge: 'SCAN / PDF → QUIZ AI',
    title: 'Biến tài liệu thành bộ đề tức thì',
    desc: 'Quét ảnh, nhập PDF hoặc ghi chú — AI sinh câu hỏi chuẩn xác từng giây.',
    accent: BRAND.indigoBright,
    glow: 'rgba(99, 102, 241, 0.34)',
    metric: '⚡ 5 giây · OCR + Streaming',
    enterFrame: 142,
  },
  {
    step: '02',
    badge: 'PAPYBOT RAG',
    title: 'Gia sư AI bám sát tài liệu gốc',
    desc: 'Hỏi bất kỳ đoạn nào — trích dẫn đúng nguồn, giải thích dễ hiểu không lan man.',
    accent: BRAND.magenta,
    glow: 'rgba(217, 70, 239, 0.30)',
    metric: '📚 Trích dẫn nguồn chuẩn xác',
    enterFrame: 158,
  },
  {
    step: '03',
    badge: 'BATTLE 1V1 & SINH TỒN',
    title: 'Ôn thi như chơi game — Nhớ lâu gấp đôi',
    desc: 'Đấu trí 1v1 thời gian thực, vượt ải sinh tồn & leo bảng xếp hạng bạn bè.',
    accent: BRAND.gold,
    glow: 'rgba(246, 195, 88, 0.32)',
    metric: '🏆 Active Recall + ELO Arena',
    enterFrame: 174,
  },
];

const SAND_PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: ((i * 67 + 29) % 640) + 40,
  startY: ((i * 89 + 17) % 420) + 100,
  size: 3 + (i % 4) * 1.6,
  speed: 1.4 + (i % 5) * 0.45,
  gold: i % 3 === 0,
}));

const CONVERGE_STARS = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const dist = 250 + (i % 4) * 58;
  return {
    id: i,
    startX: Math.cos(angle) * dist,
    startY: Math.sin(angle) * dist,
    orbitR: 138 + (i % 3) * 34,
    angle,
    size: 4 + (i % 3) * 2.2,
    isGold: i % 3 === 0,
  };
});

/**
 * Act 1 (0 -> 90): Pain Point — Op-Art Droste Infinite Document Tunnel + Forgetting Sand.
 * Frame 0 is intentionally luminous & crisp so it doubles as the 0ms poster frame!
 */
const Act1PainPointTunnel: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();

  // Exit origami pinch into Act 2 at frames 84..96
  const foldOut = interpolate(frame, [82, 95], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const actOpacity = interpolate(frame, [88, 96], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame > 98) return null;

  const line1 = kineticReveal(frame, 2, 12);
  const line2 = kineticReveal(frame, 24, 14);
  const forgetProgress = interpolate(frame, [38, 84], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const tunnelSpeed = frame * 0.0155;
  const ringCount = 9;

  return (
    <AbsoluteFill
      style={{
        opacity: actOpacity,
        justifyContent: 'center',
        alignItems: 'center',
        perspective: 980,
      }}
    >
      {/* Op-Art Concentric Droste Depth Tunnel Rings */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${1 - foldOut * 0.45}) rotate(${foldOut * 48}deg)`,
        }}
      >
        {Array.from({ length: ringCount }, (_, idx) => {
          const phase = (idx / ringCount + tunnelSpeed) % 1;
          const { scale, rotate, opacity } = drosteTunnelTransform(phase, 46);
          const isGoldRing = idx % 3 === 0;
          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                width: 150,
                height: 150,
                borderRadius: 28,
                border: `2.5px solid ${
                  isGoldRing
                    ? 'rgba(246, 195, 88, 0.52)'
                    : idx % 2 === 0
                      ? 'rgba(99, 102, 241, 0.56)'
                      : 'rgba(192, 38, 211, 0.44)'
                }`,
                boxShadow: isGoldRing
                  ? '0 0 24px rgba(245, 158, 11, 0.22)'
                  : '0 0 22px rgba(124, 58, 237, 0.24)',
                transform: `scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`,
                opacity: opacity * 0.85,
              }}
            />
          );
        })}
      </div>

      {/* Spiraling Overwhelming PDF / Slide / Note Cards (Origami Fold on Exit) */}
      {CHAOS_DOCS.map((doc, i) => {
        const phase = (doc.phaseOffset + tunnelSpeed * 0.72) % 1;
        const spiralScale = 0.52 + phase * 0.75;
        const rad = (doc.angle * Math.PI) / 180 + frame * 0.017;
        const pull = 1 - foldOut * 0.92;
        const x = Math.cos(rad) * doc.radius * (0.72 + phase * 0.45) * pull;
        const y = Math.sin(rad) * doc.radius * (0.72 + phase * 0.45) * pull;
        const cardOpacity = interpolate(phase, [0, 0.14, 0.84, 1], [0.15, 0.95, 0.88, 0.2]);
        const foldRotY = foldOut * (i % 2 === 0 ? 82 : -82);
        const foldRotX = foldOut * 55;

        return (
          <div
            key={doc.label}
            style={{
              position: 'absolute',
              width: 154,
              padding: '11px 13px',
              borderRadius: 14,
              background: 'linear-gradient(145deg, rgba(16, 23, 66, 0.90), rgba(10, 14, 42, 0.94))',
              border: `1.5px solid ${doc.accent}88`,
              boxShadow: `0 12px 28px rgba(3, 6, 22, 0.7), 0 0 18px ${doc.accent}33`,
              transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(spiralScale * (1 - foldOut * 0.55)).toFixed(3)}) rotate(${(Math.sin(rad) * 14).toFixed(1)}deg) rotateY(${foldRotY.toFixed(1)}deg) rotateX(${foldRotX.toFixed(1)}deg)`,
              opacity: cardOpacity,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: doc.accent }} />
              <span
                style={{
                  color: BRAND.lavender,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {doc.label}
              </span>
            </div>
            {Array.from({ length: doc.lines }, (_, l) => (
              <div
                key={l}
                style={{
                  height: 4,
                  width: `${86 - l * 13}%`,
                  borderRadius: 2,
                  backgroundColor: 'rgba(199, 210, 254, 0.24)',
                  marginBottom: 4,
                }}
              />
            ))}
          </div>
        );
      })}

      {/* Ebbinghaus Forgetting Sand Particles drifting downward */}
      {SAND_PARTICLES.map((p) => {
        const y = p.startY + forgetProgress * p.speed * 195;
        const op = interpolate(forgetProgress, [0, 0.2, 0.85, 1], [0.25, 0.85, 0.75, 0]);
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.gold ? BRAND.gold : BRAND.periwinkle,
              boxShadow: `0 0 8px ${p.gold ? BRAND.amber : BRAND.indigoBright}`,
              opacity: op,
            }}
          />
        );
      })}

      {/* Center High-Contrast Pain-Point Kinetic Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: 556,
          padding: '28px 30px',
          borderRadius: 28,
          background: 'linear-gradient(155deg, rgba(8, 12, 42, 0.88), rgba(14, 19, 60, 0.80))',
          border: '1.5px solid rgba(165, 180, 252, 0.34)',
          boxShadow: '0 22px 60px rgba(3, 6, 24, 0.85), inset 0 1px 0 rgba(255,255,255,0.14)',
          textAlign: 'center',
          transform: `scale(${(0.92 + beatSpring(frame, fps, 0, 16, 150) * 0.08) * (1 - foldOut * 0.35)}) rotateX(${foldOut * 42}deg)`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(244, 63, 94, 0.16)',
            border: '1px solid rgba(251, 113, 133, 0.45)',
            marginBottom: 16,
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BRAND.rose }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1.6,
              color: '#FECDD3',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            QUÁ TẢI TÀI LIỆU · QUÊN NHANH TRƯỚC GIỜ THI
          </span>
        </div>

        <div
          style={{
            fontSize: 39,
            fontWeight: 900,
            lineHeight: 1.2,
            color: BRAND.white,
            letterSpacing: -0.6,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: line1.opacity,
            transform: `translateY(${line1.translateY}px)`,
          }}
        >
          Học cả trăm trang…
        </div>

        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            lineHeight: 1.24,
            marginTop: 10,
            backgroundImage: 'linear-gradient(95deg, #FDA4AF 0%, #FDE68A 52%, #F59E0B 100%)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: line2.opacity,
            transform: `translateY(${line2.translateY}px)`,
          }}
        >
          nhưng vẫn quên sạch trước giờ thi?
        </div>

        {/* Simulated Memory Retention Drop Bar */}
        <div style={{ marginTop: 22, padding: '0 26px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 700,
              color: BRAND.lavender,
              marginBottom: 7,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <span>Trí nhớ thụ động (đọc chay)</span>
            <span style={{ color: BRAND.rose }}>
              {Math.round(interpolate(forgetProgress, [0, 1], [82, 18]))}%
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              backgroundColor: 'rgba(199, 210, 254, 0.14)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${interpolate(forgetProgress, [0, 1], [82, 18])}%`,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #F59E0B, #FB7185)',
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Act 2 (90 -> 204): Golden Laser Cut -> Forced-Perspective Logo "P" Morph ->
 * Portal Zoom Transition -> 3 Beat-Synced Core Value Motion Cards.
 */
const Act2IllusionTwistAndFeatures: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();

  if (frame < 86 || frame > 212) return null;

  // Sub-beat 2A: Golden Laser Sweep (88 -> 104) & Logo Origami Lock (92 -> 126)
  const laserProgress = interpolate(frame, [87, 102], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const laserOpacity = interpolate(frame, [87, 94, 104], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const logoSpring = beatSpring(frame, fps, 92, 14, 165);
  const logoTiltY = interpolate(logoSpring, [0, 1], [-68, 0]);

  // Sub-beat 2B: Portal Zoom THROUGH the Papyrus "P" arch (124 -> 144)
  const portal = portalZoomCurve(frame, 124, 144);
  const logoSectionOpacity = interpolate(frame, [90, 96, 138, 144], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Sub-beat 2C: 3 Feature Cards Stage (140 -> 210)
  const cardsSectionOpacity = interpolate(frame, [139, 146, 200, 210], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardsExitScale = interpolate(frame, [200, 210], [1, 0.82], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });

  const subTitleReveal = kineticReveal(frame, 98, 11);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 1100 }}>
      {/* Golden Light Blade Cutting Across the Chaos */}
      {laserOpacity > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: -140,
            right: -140,
            top: `${interpolate(laserProgress, [0, 1], [15, 85])}%`,
            height: 6,
            background: 'linear-gradient(90deg, transparent, #FFF6CE, #F6C358, #FFF6CE, transparent)',
            boxShadow: '0 0 38px 12px rgba(246, 195, 88, 0.85)',
            transform: 'rotate(-8deg)',
            opacity: laserOpacity,
            zIndex: 30,
          }}
        />
      )}

      {/* Sub-beat 2A & 2B: Forced-Perspective Papyrus Logo + Portal Match-Cut */}
      {frame <= 146 && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: logoSectionOpacity,
          }}
        >
          {/* Op-Art Warp Portal Rings expanding radially */}
          {[0, 1, 2, 3].map((r) => {
            const ringScale = (0.72 + r * 0.28) * (0.85 + logoSpring * 0.15) * (1 + portal.progress * (2.6 + r * 0.9));
            return (
              <div
                key={r}
                style={{
                  position: 'absolute',
                  width: 240,
                  height: 240,
                  borderRadius: 999,
                  border: `2px solid ${r % 2 === 0 ? 'rgba(124, 58, 237, 0.55)' : 'rgba(246, 195, 88, 0.52)'}`,
                  transform: `scale(${ringScale.toFixed(3)}) rotate(${frame * (r % 2 === 0 ? 1.8 : -2.2)}deg)`,
                  opacity: Math.max(0, 0.8 - r * 0.14),
                }}
              />
            );
          })}

          {/* Sculpted Logo Medallion zooming into Portal */}
          <div
            style={{
              width: 224,
              height: 224,
              borderRadius: 56,
              overflow: 'hidden',
              border: '2.5px solid rgba(246, 195, 88, 0.72)',
              boxShadow:
                '0 0 60px rgba(109, 74, 255, 0.75), 0 0 110px rgba(245, 158, 11, 0.32)',
              transform: `scale(${(logoSpring * portal.scale).toFixed(4)}) rotateY(${logoTiltY.toFixed(1)}deg)`,
              backgroundColor: BRAND.bgDeep,
            }}
          >
            <Img
              src={staticFile('papyrus-logo.png')}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Caption before portal dive */}
          <div
            style={{
              position: 'absolute',
              bottom: 112,
              textAlign: 'center',
              opacity: subTitleReveal.opacity * (1 - portal.progress * 2.5),
              transform: `translateY(${subTitleReveal.translateY}px)`,
            }}
          >
            <div
              style={{
                fontSize: 31,
                fontWeight: 900,
                backgroundImage: 'linear-gradient(95deg, #FFFFFF, #E0E7FF, #FDE68A)',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              Một cú chạm — Đảo chiều cách học
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Portal White-Gold Energy Flash */}
      {portal.flashOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255, 246, 206, 0.95) 0%, rgba(124, 58, 237, 0.55) 45%, transparent 78%)',
            opacity: portal.flashOpacity,
            zIndex: 25,
          }}
        />
      )}

      {/* Sub-beat 2C: 3 Beat-Synced Spatial Glass Value Cards */}
      {frame >= 139 && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: cardsSectionOpacity,
            transform: `scale(${cardsExitScale.toFixed(4)})`,
            padding: '44px 36px',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 2.6,
              color: BRAND.gold,
              marginBottom: 8,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            VÌ SAO CHỌN PAPYRUS?
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: BRAND.white,
              marginBottom: 24,
              textAlign: 'center',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            3 bước biến tài liệu thành điểm số
          </div>

          <div style={{ width: '100%', maxWidth: 610, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURE_CARDS.map((card, idx) => {
              const s = beatSpring(frame, fps, card.enterFrame, 14, 185);
              const slideX = (1 - s) * (idx % 2 === 0 ? -90 : 90);
              const rotY = (1 - s) * (idx % 2 === 0 ? 22 : -22);
              const isSpotlight =
                frame >= card.enterFrame + 2 && frame < card.enterFrame + 22;

              return (
                <div
                  key={card.step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    padding: '18px 22px',
                    borderRadius: 22,
                    background: 'linear-gradient(135deg, rgba(15, 22, 64, 0.92), rgba(9, 13, 40, 0.94))',
                    border: `1.5px solid ${isSpotlight ? card.accent : `${card.accent}66`}`,
                    boxShadow: isSpotlight
                      ? `0 16px 38px ${card.glow}, inset 0 1px 0 rgba(255,255,255,0.18)`
                      : '0 10px 26px rgba(3, 6, 22, 0.65)',
                    transform: `translateX(${slideX.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) scale(${(0.92 + s * 0.08).toFixed(4)})`,
                    opacity: Math.min(1, s * 1.4),
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      background: `linear-gradient(135deg, ${card.accent}33, ${card.accent}18)`,
                      border: `1.5px solid ${card.accent}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 900,
                      color: BRAND.white,
                      flexShrink: 0,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    {card.step}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: 1.3,
                          color: card.accent,
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                        }}
                      >
                        {card.badge}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: BRAND.goldBright,
                          padding: '3px 9px',
                          borderRadius: 999,
                          backgroundColor: 'rgba(246, 195, 88, 0.14)',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                        }}
                      >
                        {card.metric}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: BRAND.white,
                        lineHeight: 1.22,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    >
                      {card.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: BRAND.lavender,
                        marginTop: 4,
                        lineHeight: 1.35,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    >
                      {card.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/**
 * Act 3 (204 -> 285): Converging Kinetic Lock-In — Stardust & Op-Art Rings converge
 * into the official Papyrus Crest + Value Payoff.
 */
const Act3ConvergingPayoff: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();

  if (frame < 200) return null;

  const localF = frame - 204;
  const enterOpacity = interpolate(frame, [200, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crestSpring = beatSpring(frame, fps, 206, 14, 150);
  const convergeT = interpolate(frame, [204, 238], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const wordmark = kineticReveal(frame, 218, 14);
  const tagline = kineticReveal(frame, 228, 14);
  const pill = kineticReveal(frame, 238, 14);
  const breath = 1 + Math.sin(Math.max(0, localF) * 0.11) * 0.025;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: enterOpacity,
      }}
    >
      {/* Op-Art Converging Orbital Rings */}
      {[0, 1, 2].map((i) => {
        const size = 250 + i * 74;
        const rot = localF * (i % 2 === 0 ? 1.1 : -1.4) + i * 32;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: 999,
              border: `1.5px ${i === 1 ? 'dashed' : 'solid'} ${
                i === 0
                  ? 'rgba(246, 195, 88, 0.52)'
                  : i === 1
                    ? 'rgba(124, 58, 237, 0.55)'
                    : 'rgba(217, 70, 239, 0.34)'
              }`,
              transform: `scale(${(0.45 + convergeT * 0.55).toFixed(4)}) rotate(${rot.toFixed(1)}deg)`,
              opacity: convergeT * 0.85,
            }}
          />
        );
      })}

      {/* Converging Stardust Particles */}
      {CONVERGE_STARS.map((s) => {
        const orbitAngle = s.angle + Math.max(0, localF) * 0.022;
        const targetX = Math.cos(orbitAngle) * s.orbitR;
        const targetY = Math.sin(orbitAngle) * s.orbitR - 52;
        const x = interpolate(convergeT, [0, 1], [s.startX, targetX]);
        const y = interpolate(convergeT, [0, 1], [s.startY, targetY]);
        return (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              width: s.size,
              height: s.size,
              borderRadius: 2,
              backgroundColor: s.isGold ? BRAND.goldBright : BRAND.lavender,
              boxShadow: `0 0 12px ${s.isGold ? BRAND.amber : BRAND.violet}`,
              transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(45deg)`,
              opacity: 0.4 + convergeT * 0.6,
            }}
          />
        );
      })}

      {/* Centered Logo Crest & Final Value Payoff */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          padding: '0 40px',
        }}
      >
        <div
          style={{
            width: 178,
            height: 178,
            borderRadius: 46,
            overflow: 'hidden',
            border: '2.5px solid rgba(246, 195, 88, 0.68)',
            boxShadow:
              '0 0 54px rgba(109, 74, 255, 0.72), 0 0 96px rgba(245, 158, 11, 0.34)',
            transform: `scale(${(crestSpring * breath).toFixed(4)})`,
            backgroundColor: BRAND.bgDeep,
            marginBottom: 24,
          }}
        >
          <Img
            src={staticFile('papyrus-logo.png')}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: 11,
            paddingLeft: 11,
            backgroundImage: 'linear-gradient(108deg, #FFFFFF 0%, #E0E7FF 38%, #FDE68A 74%, #F59E0B 100%)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: wordmark.opacity,
            transform: `translateY(${wordmark.translateY}px)`,
          }}
        >
          PAPYRUS
        </div>

        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: BRAND.lavender,
            letterSpacing: 0.8,
            marginTop: 8,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: tagline.opacity,
            transform: `translateY(${tagline.translateY}px)`,
          }}
        >
          From Ancient Scroll to AI Power.
        </div>

        <div
          style={{
            marginTop: 24,
            padding: '12px 26px',
            borderRadius: 999,
            background: 'linear-gradient(95deg, rgba(79, 70, 229, 0.88), rgba(124, 58, 237, 0.90), rgba(217, 70, 239, 0.82))',
            border: '1.5px solid rgba(253, 230, 138, 0.62)',
            boxShadow: '0 10px 30px rgba(124, 58, 237, 0.52)',
            fontSize: 19,
            fontWeight: 800,
            color: BRAND.goldBright,
            letterSpacing: 0.4,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: pill.opacity,
            transform: `translateY(${pill.translateY}px) scale(${pill.scale})`,
          }}
        >
          ✦ Học ít hơn · Nhớ lâu hơn ✦
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PapyrusIllusionIntro: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle breathing nebula shift matching assets/icon.png
  const glowShiftX = Math.sin(frame * 0.04) * 28;
  const glowShiftY = Math.cos(frame * 0.03) * 22;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${50 + glowShiftX * 0.2}% ${44 + glowShiftY * 0.2}%, rgba(79, 70, 229, 0.34) 0%, rgba(124, 58, 237, 0.16) 32%, ${BRAND.bgDeep} 72%), linear-gradient(160deg, ${BRAND.bgDeep} 0%, ${BRAND.bgMid} 52%, #050819 100%)`,
        overflow: 'hidden',
      }}
    >
      {/* Subtle Op-Art Isometric Depth Grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(rgba(199, 210, 254, 0.14) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          opacity: 0.32,
          transform: `translate(${(frame * 0.35) % 36}px, ${(frame * 0.25) % 36}px)`,
        }}
      />

      {/* Ambient Golden Flare Glow */}
      <div
        style={{
          position: 'absolute',
          right: -60 + glowShiftX,
          top: -40 + glowShiftY,
          width: 340,
          height: 340,
          borderRadius: 999,
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.24) 0%, transparent 70%)',
        }}
      />

      {/* 3-Act Optical Illusion Narrative */}
      <Act1PainPointTunnel frame={frame} />
      <Act2IllusionTwistAndFeatures frame={frame} />
      <Act3ConvergingPayoff frame={frame} />

      {/* Ultra-crisp top cinema progress accent */}
      <div
        style={{
          position: 'absolute',
          left: 36,
          right: 36,
          bottom: 22,
          height: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(199, 210, 254, 0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, ((frame + 1) / 285) * 100)}%`,
            borderRadius: 999,
            background: 'linear-gradient(90deg, #6366F1, #D946EF, #F6C358)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
