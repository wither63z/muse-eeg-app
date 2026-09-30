import { MM_CSV_HEADER, formatRow, FIT_TO_HSI, makeFileName, RowState } from '@/recording/csvFormat';

describe('csvFormat', () => {
  describe('MM_CSV_HEADER', () => {
    it('has correct number of columns', () => {
      const columns = MM_CSV_HEADER.split(',');
      // 1 TimeStamp + 20 bands + 4 RAW + 6 motion + 1 HeadBandOn + 4 HSI + 1 Battery + 1 Elements = 38
      expect(columns.length).toBe(38);
    });
  });

  describe('formatRow', () => {
    const baseRow: RowState = {
      timestamp: new Date(2026, 8, 30, 12, 34, 56, 789),
      rawUv: { TP9: 1.234, AF7: -2.345, AF8: 3.456, TP10: -4.567 },
      bands: null,
      accel: { x: 0.1, y: 0.2, z: 0.9 },
      gyro: { x: 10, y: 20, z: 30 },
      headbandOn: true,
      fit: { TP9: 0, AF7: 1, AF8: 2, TP10: 0 },
      battery: { sequence: 1, percent: 85.5, voltageMv: 3800, receivedAtMs: Date.now() },
      marker: null,
    };

    it('formats timestamp correctly', () => {
      const row = formatRow(baseRow);
      const parts = row.split(',');
      expect(parts[0]).toBe('2026-09-30 12:34:56.789');
    });

    it('formats RAW values with 3 decimals', () => {
      const row = formatRow(baseRow);
      const parts = row.split(',');
      // RAW empieza en columna 21 (después de TimeStamp + 20 bandas)
      expect(parts[21]).toBe('1.234');
      expect(parts[22]).toBe('-2.345');
    });

    it('formats HSI values correctly', () => {
      const row = formatRow(baseRow);
      const parts = row.split(',');
      // Layout: 0=TimeStamp, 1-20=bands, 21-24=RAW, 25-27=accel, 28-30=gyro, 31=HeadBandOn, 32-35=HSI, 36=Battery, 37=Elements
      expect(parts[32]).toBe('1'); // TP9: 0 → 1
      expect(parts[33]).toBe('2'); // AF7: 1 → 2
      expect(parts[34]).toBe('4'); // AF8: 2 → 4
      expect(parts[35]).toBe('1'); // TP10: 0 → 1
    });

    it('formats HeadBandOn as 1/0', () => {
      const row = formatRow(baseRow);
      const parts = row.split(',');
      expect(parts[31]).toBe('1');
    });

    it('formats Battery with 1 decimal', () => {
      const row = formatRow(baseRow);
      const parts = row.split(',');
      expect(parts[36]).toBe('85.5');
    });

    it('has same number of commas as header', () => {
      const headerCommas = MM_CSV_HEADER.split(',').length - 1;
      const row = formatRow(baseRow);
      const rowCommas = row.split(',').length - 1;
      expect(rowCommas).toBe(headerCommas);
    });

    it('handles null values as empty cells', () => {
      const rowWithNulls: RowState = {
        ...baseRow,
        rawUv: { TP9: null, AF7: null, AF8: null, TP10: null },
        accel: null,
        gyro: null,
        battery: null,
      };
      const row = formatRow(rowWithNulls);
      const parts = row.split(',');
      expect(parts[21]).toBe('');
      expect(parts[22]).toBe('');
    });

    it('includes marker in Elements column', () => {
      const rowWithMarker: RowState = {
        ...baseRow,
        marker: '/Marker/1',
      };
      const row = formatRow(rowWithMarker);
      const parts = row.split(',');
      expect(parts[37]).toBe('/Marker/1');
    });
  });

  describe('FIT_TO_HSI', () => {
    it('maps fit levels correctly', () => {
      expect(FIT_TO_HSI[0]).toBe(1);
      expect(FIT_TO_HSI[1]).toBe(2);
      expect(FIT_TO_HSI[2]).toBe(4);
    });
  });

  describe('makeFileName', () => {
    it('generates correct filename format', () => {
      const d = new Date(2026, 8, 30, 12, 34, 56);
      const fileName = makeFileName(d);
      expect(fileName).toBe('mindMonitor_2026-09-30--12-34-56.csv');
    });
  });
});
