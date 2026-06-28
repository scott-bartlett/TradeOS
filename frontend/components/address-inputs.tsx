// Reusable US state select and ZIP input components
// Drop into any form that needs state/zip validation

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'Washington DC'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

interface StateSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function StateSelect({ value, onChange, className = '' }: StateSelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A6E45] bg-white ${className}`}
    >
      <option value="">State</option>
      {US_STATES.map(([abbr, name]) => (
        <option key={abbr} value={abbr}>{abbr} — {name}</option>
      ))}
    </select>
  );
}

interface ZipInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function ZipInput({ value, onChange, className = '', placeholder = '12345' }: ZipInputProps) {
  const handleChange = (raw: string) => {
    // Allow only digits and one dash
    const digits = raw.replace(/[^\d]/g, '');
    // Format as 5 or 5-4
    let formatted = digits.slice(0, 9);
    if (formatted.length > 5) {
      formatted = formatted.slice(0, 5) + '-' + formatted.slice(5);
    }
    onChange(formatted);
  };

  const isValid = /^\d{5}(-\d{4})?$/.test(value) || value === '';

  return (
    <input
      type="text"
      value={value}
      onChange={e => handleChange(e.target.value)}
      placeholder={placeholder}
      maxLength={10}
      className={`border rounded-lg px-3 py-2 text-sm focus:outline-none ${
        !isValid && value
          ? 'border-red-300 focus:border-red-400'
          : 'border-gray-200 focus:border-[#1A6E45]'
      } ${className}`}
    />
  );
}

export { US_STATES };
