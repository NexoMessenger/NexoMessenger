/** Original vector interpretation of Astra, not a cutout of the reference screenshot. */
export default function Astra() {
  return <svg className="astra-figure" viewBox="0 0 220 410" role="img" aria-label="Astra">
    <defs><linearGradient id="astra-hair" x1="0" x2="1" y2="1"><stop stopColor="#555366"/><stop offset="1" stopColor="#11111b"/></linearGradient></defs>
    {/* hair and jacket */}
    <path d="M66 82 Q59 28 110 22 Q164 25 157 88 L166 190 L54 190Z" fill="url(#astra-hair)"/>
    <path d="M63 145 Q43 148 37 177 L30 230 Q33 246 48 243 L68 206 L71 266 L150 266 L153 206 L170 229 Q185 236 190 219 L176 162 Q170 146 150 143Z" fill="#f4f2fb" stroke="#c8c5d4" strokeWidth="3"/>
    <path d="M70 155 L81 147 L140 147 L151 155 L144 254 L76 254Z" fill="#191923"/>
    <path d="M73 156 L92 181 L81 146 M148 156 L130 181 L140 146" fill="none" stroke="#b5b4c3" strokeWidth="3"/>
    <path d="M79 239 H142 V258 H79Z" fill="#f2d4ce"/>
    <path d="M76 258 H146 L151 292 L119 300 L111 282 L102 300 L69 292Z" fill="#161621" stroke="#c2bfcf" strokeWidth="2"/>
    <path d="M108 259 Q104 269 110 277 M111 259 Q119 270 113 277" stroke="#f4f2fb" fill="none" strokeWidth="2"/>
    {/* legs, stockings and shoes */}
    <path d="M78 296 L101 298 L95 345 L89 389 L70 389 L72 345Z M122 298 L145 294 L152 345 L153 389 L134 389 L128 345Z" fill="#f2d4ce"/>
    <path d="M74 324 L99 326 L95 345 L89 390 L70 390 L72 345Z M125 326 L149 323 L152 345 L153 390 L134 390 L128 345Z" fill="#1b1b28"/>
    <path d="M71 382 Q61 389 62 401 Q64 406 92 405 L92 385Z M135 385 L154 382 Q165 390 165 402 Q163 406 133 405Z" fill="#fbfaff" stroke="#bbb9c5" strokeWidth="2"/>
    {/* face */}
    <ellipse cx="110" cy="90" rx="43" ry="52" fill="#f4d5d1"/>
    <path d="M67 83 Q61 25 110 24 Q159 24 154 84 Q143 69 138 53 Q126 68 109 69 Q101 58 98 48 Q93 70 67 83Z" fill="url(#astra-hair)"/>
    <path d="M76 76 Q80 42 96 38 M145 75 Q144 48 134 35" stroke="#777384" strokeWidth="2" fill="none" opacity=".7"/>
    <ellipse cx="92" cy="94" rx="7" ry="9" fill="#6aa8e8"/><ellipse cx="128" cy="94" rx="7" ry="9" fill="#6aa8e8"/>
    <circle cx="94" cy="91" r="2.5" fill="white"/><circle cx="130" cy="91" r="2.5" fill="white"/>
    <path d="M104 115 Q110 119 116 115" fill="none" stroke="#a86d70" strokeWidth="2" strokeLinecap="round"/>
    {/* animated arm, deliberately separate from torso */}
    <g className="astra-wave"><path d="M58 151 Q42 147 34 163 L14 192 Q7 203 18 211 Q26 216 33 207 L62 176Z" fill="#f4f2fb" stroke="#c8c5d4" strokeWidth="3"/><path d="M17 193 Q7 185 10 179 L14 174 L12 165 Q12 160 16 162 L20 171 L21 160 Q22 156 25 159 L25 173 L29 165 Q33 162 34 167 L31 181 L25 193Z" fill="#f4d5d1" stroke="#d5a8a3" strokeWidth="2"/></g>
  </svg>
}
