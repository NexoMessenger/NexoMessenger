/** The moving train is decorative; the real name remains available to assistive technology. */
export function TrainName({ name }: { name: string }) {
  return <span className="train-name">
    <span className="train-name-text">{name}</span>
    <span className="train-name-track" aria-hidden="true">
      <svg className="train-name-train" viewBox="0 0 1000 56" preserveAspectRatio="none" focusable="false">
        {/* Two streamlined cabs, pointing outwards, and eight separate passenger cars. */}
        <g className="train-cab" transform="translate(1000 0) scale(-1 1)">
          <path d="M909 11 H925 Q950 11 971 23 L996 37 Q999 40 995 43 L985 46 H909 Z" fill="#c7d6dc" stroke="#f3fbff" strokeWidth="1.5" />
          <path d="M916 15 H927 Q947 15 963 24 L975 31 H916 Z" fill="#263c50" />
          <path d="M922 17 H930 Q946 17 959 24 L965 28 H922 Z" fill="#8bd8f2" />
          <path d="M910 34 H982 L992 39 H910 Z" fill="#258acb" />
          <path d="M910 41 H991 L985 45 H910 Z" fill="#455963" />
          <path d="M984 35 L991 38 H983 Z" fill="#fff9d5" />
        </g>
        {/* Small visible couplers keep the cars connected without merging their bodies. */}
        {Array.from({ length: 9 }, (_, i) => <path key={`coupler-${i}`} d={`M${90 + i * 102} 39 h6`} stroke="#4f6875" strokeWidth="3" />)}
        {Array.from({ length: 8 }, (_, i) => <g className="train-car train-passenger" key={i} transform={`translate(${96 + i * 102} 0)`}>
          <rect x="0" y="11" width="96" height="35" rx="4" fill="#c7d6dc" stroke="#f3fbff" strokeWidth="1.5" />
          <path d="M3 15 H93 V31 H3 Z" fill="#263c50" />
          <path d="M7 17 H19 V28 H7 Z M23 17 H35 V28 H23 Z M39 17 H51 V28 H39 Z M55 17 H67 V28 H55 Z M71 17 H83 V28 H71 Z" fill="#8bd8f2" />
          <path d="M2 34 H94 V39 H2 Z" fill="#258acb" />
          <path d="M2 41 H94 V45 H2 Z" fill="#455963" />
          <path d="M88 13 V43" stroke="#8fa7b2" strokeWidth="1.5" />
        </g>)}
        <g className="train-cab">
          <path d="M909 11 H925 Q950 11 971 23 L996 37 Q999 40 995 43 L985 46 H909 Z" fill="#c7d6dc" stroke="#f3fbff" strokeWidth="1.5" />
          <path d="M916 15 H927 Q947 15 963 24 L975 31 H916 Z" fill="#263c50" />
          <path d="M922 17 H930 Q946 17 959 24 L965 28 H922 Z" fill="#8bd8f2" />
          <path d="M910 34 H982 L992 39 H910 Z" fill="#258acb" />
          <path d="M910 41 H991 L985 45 H910 Z" fill="#455963" />
          <path d="M984 35 L991 38 H983 Z" fill="#fff9d5" />
        </g>
        <g className="train-wind train-wind-one" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2">
          <path d="M25 5 h42 M119 4 h25 M203 7 h53 M304 3 h39 M417 6 h43 M535 4 h30 M633 6 h52 M746 3 h32 M855 6 h55" />
          <path d="M10 51 h35 M98 53 h55 M218 50 h35 M329 53 h47 M455 51 h30 M573 53 h55 M690 50 h38 M799 53 h47 M919 51 h35" />
        </g>
        <g className="train-wind train-wind-two" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.5">
          <path d="M70 8 h24 M165 2 h38 M267 8 h28 M371 5 h31 M488 8 h27 M593 2 h35 M708 8 h25 M809 5 h32 M945 8 h24" />
          <path d="M62 49 h25 M173 54 h28 M278 48 h35 M398 54 h31 M517 49 h38 M647 54 h26 M758 49 h29 M875 54 h30 M965 49 h22" />
        </g>
      </svg>
    </span>
  </span>
}
