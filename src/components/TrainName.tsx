/** The moving train is decorative; the real name remains available to assistive technology. */
export function TrainName({ name }: { name: string }) {
  return <span className="train-name">
    <span className="train-name-text">{name}</span>
    <span className="train-name-track" aria-hidden="true">
      <svg className="train-name-train" viewBox="0 0 160 48" preserveAspectRatio="none" focusable="false">
        {/* An opaque, streamlined train passes in front of the letters. */}
        <path d="M2 8 Q2 3 9 3 H108 Q127 3 144 16 L158 29 Q160 31 157 36 L149 41 H8 Q2 41 2 35 Z" fill="#a8bfca" stroke="#e4f7ff" strokeWidth="2" />
        <path d="M4 10 H109 Q126 10 142 20 L152 29 H4 Z" fill="#304452" />
        <path d="M8 12 H35 V22 H8 Z M39 12 H66 V22 H39 Z M70 12 H97 V22 H70 Z" fill="#80d5ed" />
        <path d="M102 12 H110 Q125 12 137 20 L142 24 H102 Z" fill="#80d5ed" />
        <path d="M4 29 H153 L157 32 L153 35 H4 Z" fill="#38d9fa" />
        <path d="M8 38 H149 L142 43 H13 Z" fill="#273b49" />
        <path d="M16 43 H132" stroke="#d7faff" strokeWidth="2" strokeLinecap="round" />
        <path d="M147 25 L154 29 H148 Z" fill="#f2ffff" />
      </svg>
    </span>
  </span>
}
