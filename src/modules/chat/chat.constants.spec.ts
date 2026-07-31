import { SYSTEM_PROMPT_BASE, buildContextBlock } from './chat.constants';

describe('buildContextBlock', () => {
  it('returns a fallback message when no chunks are provided', () => {
    const result = buildContextBlock([]);
    expect(result).toBe(
      'No relevant context was found in the knowledge base for this question.',
    );
  });

  it('formats a single chunk with its source', () => {
    const result = buildContextBlock([
      { content: 'KYC is required before sending.', source: 'kyc-faq.md' },
    ]);
    expect(result).toContain('[Context 1 — kyc-faq.md]');
    expect(result).toContain('KYC is required before sending.');
  });

  it('formats a chunk with a null source without a trailing dash', () => {
    const result = buildContextBlock([
      { content: 'Some content', source: null },
    ]);
    expect(result).toBe('[Context 1]\nSome content');
  });

  it('joins multiple chunks with a blank line between them, numbered in order', () => {
    const result = buildContextBlock([
      { content: 'First chunk', source: 'a.md' },
      { content: 'Second chunk', source: 'b.md' },
    ]);
    expect(result).toContain('[Context 1 — a.md]\nFirst chunk');
    expect(result).toContain('[Context 2 — b.md]\nSecond chunk');
    expect(result.split('\n\n')).toHaveLength(2);
  });
});

describe('SYSTEM_PROMPT_BASE — guardrail presence sanity checks', () => {
  it.each([
    ['topical scope', /What you help with/i],
    ['jailbreak resistance', /jailbreak/i],
    ['prompt injection defense', /prompt injection/i],
    ['hallucination/grounding rule', /ONLY using the context/i],
    ['no financial advice', /financial or investment advice/i],
    ['no cross-user data access', /another user's data/i],
    ['no real money/mainnet framing', /testnet only/i],
    ['no credential handling', /passwords, PINs, or seed phrases/i],
    ['friendly fallback tone', /Is there anything else/i],
  ])('includes guardrail language for: %s', (_label, pattern) => {
    expect(SYSTEM_PROMPT_BASE).toMatch(pattern);
  });
});
