import {redact} from '../../../../src/infrastructure/log/redact';

describe('Given a text to redact', () => {
  it('Should redact an email address', () => {
    expect(
      redact('rejected first.last+tag-x@my-host.mail-srv.example ok'),
    ).toBe('rejected [redacted] ok');
  });

  it('Should redact a token mixing letters and digits', () => {
    expect(redact('token aB3dE_fG6hI-jK9lMnOpQrSt2 ok')).toBe(
      'token [redacted] ok',
    );
  });

  it('Should keep a long identifier without digits', () => {
    expect(redact('table customer_billing_addresses_history ok')).toBe(
      'table customer_billing_addresses_history ok',
    );
  });
});
