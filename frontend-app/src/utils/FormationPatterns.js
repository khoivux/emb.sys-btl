/**
 * FormationPatterns.js
 * Thư viện tính toán tọa độ đội hình bay cho drone.
 *
 * Chuyển đổi khoảng cách (mét) sang độ GPS tại vĩ độ ~21°N (Hà Nội):
 *   1 mét ≈ 0.000009 độ latitude
 *   1 mét ≈ 0.0000115 độ longitude
 */

const LAT_PER_METER = 0.000009;
const LNG_PER_METER = 0.0000115;

/**
 * Bay thẳng hàng — dàn drone thành 1 hàng ngang hoặc dọc từ tâm.
 * @param {Array} drones - Danh sách drone [{ device_id, latitude, longitude, ... }]
 * @param {number} centerLat - Vĩ độ tâm đội hình
 * @param {number} centerLng - Kinh độ tâm đội hình
 * @param {'horizontal'|'vertical'} direction - Hướng dàn hàng
 * @param {number} spacing - Khoảng cách giữa các drone (mét)
 * @returns {Array} [{ droneId, targetLat, targetLng }]
 */
export function lineFormation(drones, centerLat, centerLng, direction = 'horizontal', spacing = 10) {
  const count = drones.length;
  const totalLength = (count - 1) * spacing;
  const startOffset = -totalLength / 2;

  return drones.map((drone, i) => {
    const offset = startOffset + i * spacing;
    let targetLat = centerLat;
    let targetLng = centerLng;

    if (direction === 'horizontal') {
      targetLng += offset * LNG_PER_METER;
    } else {
      targetLat += offset * LAT_PER_METER;
    }

    return {
      droneId: drone.device_id,
      targetLat,
      targetLng,
    };
  });
}

/**
 * Bay vòng tròn — xếp drone phân bố đều trên đường tròn.
 * @param {Array} drones - Danh sách drone
 * @param {number} centerLat - Vĩ độ tâm
 * @param {number} centerLng - Kinh độ tâm
 * @param {number} radiusMeters - Bán kính (mét)
 * @returns {Array} [{ droneId, targetLat, targetLng }]
 */
export function circleFormation(drones, centerLat, centerLng, radiusMeters = 20) {
  const count = drones.length;
  return drones.map((drone, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2; // bắt đầu từ trên (12h)
    return {
      droneId: drone.device_id,
      targetLat: centerLat + Math.sin(angle) * radiusMeters * LAT_PER_METER,
      targetLng: centerLng + Math.cos(angle) * radiusMeters * LNG_PER_METER,
    };
  });
}

/**
 * Xếp lưới — dàn drone thành ô lưới hình chữ nhật.
 * @param {Array} drones - Danh sách drone
 * @param {number} originLat - Vĩ độ gốc (góc trái trên)
 * @param {number} originLng - Kinh độ gốc
 * @param {number} columns - Số cột
 * @param {number} spacingMeters - Khoảng cách giữa các drone (mét)
 * @returns {Array} [{ droneId, targetLat, targetLng }]
 */
export function gridFormation(drones, originLat, originLng, columns = 3, spacingMeters = 10) {
  // Center the grid on the origin point
  const rows = Math.ceil(drones.length / columns);
  const gridWidth = (columns - 1) * spacingMeters;
  const gridHeight = (rows - 1) * spacingMeters;

  return drones.map((drone, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    return {
      droneId: drone.device_id,
      targetLat: originLat - row * spacingMeters * LAT_PER_METER + (gridHeight / 2) * LAT_PER_METER,
      targetLng: originLng + col * spacingMeters * LNG_PER_METER - (gridWidth / 2) * LNG_PER_METER,
    };
  });
}

/**
 * Font bitmap 5x7 đơn giản cho xếp chữ.
 * Mỗi ký tự là mảng 7 hàng, mỗi hàng là chuỗi 5 ký tự ('X' = điểm, '.' = trống).
 */
const BITMAP_FONT = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
  C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  E: ['XXXXX', 'X....', 'X....', 'XXX..', 'X....', 'X....', 'XXXXX'],
  F: ['XXXXX', 'X....', 'X....', 'XXX..', 'X....', 'X....', 'X....'],
  G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'],
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  J: ['..XXX', '...X.', '...X.', '...X.', 'X..X.', 'X..X.', '.XX..'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X', 'X...X', 'X...X'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
  Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  S: ['.XXX.', 'X...X', 'X....', '.XXX.', '....X', 'X...X', '.XXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  W: ['X...X', 'X...X', 'X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'],
  X: ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
  Z: ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
  '0': ['.XXX.', 'X..XX', 'X.X.X', 'XX..X', 'X...X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  '2': ['.XXX.', 'X...X', '....X', '..XX.', '.X...', 'X....', 'XXXXX'],
  '3': ['.XXX.', 'X...X', '....X', '..XX.', '....X', 'X...X', '.XXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['.XXX.', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '....X', '.XXX.'],
};

/**
 * Xếp chữ — bay tạo hình chữ cái/số trên trời.
 * @param {Array} drones - Danh sách drone
 * @param {string} text - Chuỗi ký tự cần xếp (A-Z, 0-9)
 * @param {number} centerLat - Vĩ độ tâm
 * @param {number} centerLng - Kinh độ tâm
 * @param {number} scaleMeters - Kích thước mỗi "pixel" của chữ (mét)
 * @returns {{ positions: Array, minDronesRequired: number }}
 */
export function textFormation(drones, text, centerLat, centerLng, scaleMeters = 5) {
  const charUpper = text.toUpperCase();
  
  // Thu thập tất cả điểm cần đặt drone
  let allPoints = [];
  let charOffsetX = 0;

  for (let c = 0; c < charUpper.length; c++) {
    const ch = charUpper[c];
    const bitmap = BITMAP_FONT[ch];
    if (!bitmap) {
      charOffsetX += 3; // space cho ký tự không hỗ trợ
      continue;
    }

    for (let row = 0; row < bitmap.length; row++) {
      for (let col = 0; col < bitmap[row].length; col++) {
        if (bitmap[row][col] === 'X') {
          allPoints.push({
            x: charOffsetX + col,
            y: row,
          });
        }
      }
    }
    charOffsetX += 6; // 5 cột + 1 khoảng cách giữa các chữ
  }

  const minDronesRequired = allPoints.length;

  // Nếu drone không đủ → chỉ lấy allPoints.length đầu tiên (hoặc trống)
  if (drones.length < minDronesRequired) {
    return { positions: [], minDronesRequired };
  }

  // Tính tâm của toàn bộ text
  const maxX = Math.max(...allPoints.map(p => p.x));
  const maxY = Math.max(...allPoints.map(p => p.y));
  const textCenterX = maxX / 2;
  const textCenterY = maxY / 2;

  const positions = allPoints.slice(0, drones.length).map((pt, i) => ({
    droneId: drones[i].device_id,
    targetLat: centerLat - (pt.y - textCenterY) * scaleMeters * LAT_PER_METER,
    targetLng: centerLng + (pt.x - textCenterX) * scaleMeters * LNG_PER_METER,
  }));

  return { positions, minDronesRequired };
}

/**
 * Tính số drone tối thiểu cho mỗi chữ.
 */
export function getTextMinDrones(text) {
  const charUpper = text.toUpperCase();
  let count = 0;
  for (const ch of charUpper) {
    const bitmap = BITMAP_FONT[ch];
    if (bitmap) {
      for (const row of bitmap) {
        for (const c of row) {
          if (c === 'X') count++;
        }
      }
    }
  }
  return count;
}

/**
 * Danh sách các mẫu đội hình có sẵn.
 */
export const FORMATION_PATTERNS = [
  {
    id: 'line',
    name: 'Bay thẳng hàng',
    description: 'Dàn drone thành 1 hàng ngang hoặc dọc',
    minDrones: 2,
    icon: '━━━',
  },
  {
    id: 'circle',
    name: 'Bay vòng tròn',
    description: 'Xếp drone thành vòng tròn',
    minDrones: 3,
    icon: '◯',
  },
  {
    id: 'grid',
    name: 'Xếp lưới',
    description: 'Dàn drone thành ô lưới hình chữ nhật',
    minDrones: 4,
    icon: '⊞',
  },
  {
    id: 'text',
    name: 'Xếp chữ',
    description: 'Bay tạo hình chữ cái trên trời',
    minDrones: null, // Tùy chữ
    icon: 'Aa',
  },
];
