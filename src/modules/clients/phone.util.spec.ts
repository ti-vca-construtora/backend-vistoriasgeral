import { isValidBrazilPhone, normalizeBrazilPhone } from './phone.util';

describe('normalizeBrazilPhone', () => {
  it.each([
    ['77981243447', '5577981243447'],
    [77981243447, '5577981243447'],
    ['+55 (77) 98124-3447', '5577981243447'],
    ['5577981243447', '5577981243447'],
    ['005577981243447', '5577981243447'],
    ['077981243447', '5577981243447'],
    ['02177981243447', '5577981243447'],
    ['7.7981243447e10', '5577981243447'],
    ['(77) 3421-1234', '557734211234'],
  ])('normalizes %p', (input, expected) => {
    expect(normalizeBrazilPhone(input)).toBe(expected);
  });

  it('keeps empty phones optional and rejects incomplete numbers', () => {
    expect(normalizeBrazilPhone('')).toBeUndefined();
    expect(isValidBrazilPhone(normalizeBrazilPhone('98124-3447'))).toBe(false);
  });
});
