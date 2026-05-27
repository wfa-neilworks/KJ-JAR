export default function Toggle({ value, onChange, labelOn = 'ON', labelOff = 'OFF' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex items-center w-20 h-9 rounded-full transition-colors duration-300 focus:outline-none shadow-inner ${
        value ? 'bg-green-600' : 'bg-red-700'
      }`}
    >
      {/* Label text */}
      <span
        className={`absolute text-white text-xs font-bold tracking-wide select-none transition-opacity duration-200 ${
          value ? 'left-3 opacity-100' : 'left-3 opacity-0'
        }`}
      >
        {labelOn}
      </span>
      <span
        className={`absolute text-white text-xs font-bold tracking-wide select-none transition-opacity duration-200 ${
          !value ? 'right-3 opacity-100' : 'right-3 opacity-0'
        }`}
      >
        {labelOff}
      </span>
      {/* Thumb */}
      <span
        className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow-md transition-transform duration-300 ${
          value ? 'translate-x-11' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
