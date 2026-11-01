/** The moving train is decorative; the real name remains available to assistive technology. */
export function TrainName({ name }: { name: string }) {
  return <span className="train-name">
    <span className="train-name-text">{name}</span>
    <span className="train-name-track" aria-hidden="true">
      <svg className="train-name-train" viewBox="0 0 440 48" preserveAspectRatio="none" focusable="false">
        {/* Eight cars in total: two streamlined cabs and six passenger cars. */}
        <g className="train-car train-cab">
          <path d="M2 33 L17 19 Q35 5 57 5 H69 V40 H10 Q3 40 2 36 Z" fill="#afc5d0" stroke="#e8f8ff" strokeWidth="1.5" />
          <path d="M11 29 L21 21 Q37 10 57 10 H65 V25 H19 Z" fill="#304857" />
          <path d="M23 22 Q37 13 50 12 V23 H22 Z M54 12 H64 V23 H54 Z" fill="#8ad9ec" />
          <path d="M4 32 H69 V35 H4 Z" fill="#42d9f6" />
          <path d="M8 37 H69 V40 H12 Z" fill="#334d5c" />
        </g>
        {Array.from({ length: 6 }, (_, i) => <g className="train-car train-passenger" key={i} transform={`translate(${70 + i * 50} 0)`}>
          <rect x="0" y="5" width="49" height="35" rx="2" fill="#afc5d0" stroke="#e8f8ff" strokeWidth="1.5" />
          <path d="M2 10 H47 V26 H2 Z" fill="#304857" />
          <path d="M5 12 H13 V23 H5 Z M16 12 H24 V23 H16 Z M27 12 H35 V23 H27 Z M38 12 H45 V23 H38 Z" fill="#8ad9ec" />
          <path d="M1 32 H48 V35 H1 Z" fill="#42d9f6" />
          <path d="M1 37 H48 V40 H1 Z" fill="#334d5c" />
        </g>)}
        <g className="train-car train-cab">
          <path d="M371 5 H383 Q405 5 423 19 L438 33 Q437 40 430 40 H371 Z" fill="#afc5d0" stroke="#e8f8ff" strokeWidth="1.5" />
          <path d="M375 10 H383 Q403 10 419 21 L429 29 H421 L375 25 Z" fill="#304857" />
          <path d="M376 12 H386 V23 H376 Z M390 12 Q403 13 417 22 L418 23 H390 Z" fill="#8ad9ec" />
          <path d="M371 32 H436 L434 35 H371 Z" fill="#42d9f6" />
          <path d="M371 37 H432 L428 40 H371 Z" fill="#334d5c" />
        </g>
        {/* Wind streaks move with the train and do not intercept clicks. */}
        <g fill="none" stroke="#fff" strokeLinecap="round" opacity=".85">
          <path d="M4 2 H38 M54 2 H80 M135 2 H171 M267 2 H304 M355 2 H389" strokeWidth="1.5" />
          <path d="M5 44 H33 M50 46 H94 M150 44 H180 M227 46 H268 M318 44 H350 M378 46 H410" strokeWidth="1.5" />
        </g>
      </svg>
    </span>
  </span>
}
