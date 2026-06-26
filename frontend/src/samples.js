// Demo contracts for the sample picker. Each contains a mix of fair, unfair and
// illegal clauses so the analysis is visibly useful in a demo.

export const SAMPLES = [
  {
    id: 'lease',
    label: 'Predatory rental lease',
    kind: 'Tenancy',
    jurisdiction: 'IN',
    counterparty: 'Skyline Rentals',
    text: `RESIDENTIAL RENTAL AGREEMENT

1. The Tenant shall pay rent of Rs. 15,000 payable in advance on or before the 5th day of each month.

2. The Tenant shall deposit six months rent as security deposit, and the Landlord shall forfeit the deposit in full if the Tenant vacates before completing 11 months for any reason whatsoever.

3. The Landlord may evict the Tenant and require them to vacate within 24 hours, without notice, at the Landlord's sole discretion.

4. The Landlord may change or modify these terms at any time without notice to the Tenant.

5. The Tenant shall keep the premises clean and shall not cause damage beyond normal wear and tear.

6. Either party may terminate this agreement by giving one month written notice.`
  },
  {
    id: 'gig',
    label: 'Gig-worker contract',
    kind: 'Work',
    jurisdiction: 'IN',
    counterparty: 'QuickDeliver Pvt Ltd',
    text: `DELIVERY PARTNER AGREEMENT

1. The Partner will be paid per completed delivery as per the prevailing rate card.

2. The Company may withhold wages and the Partner's pending salary will be forfeited if the Partner stops working without giving three months notice.

3. The Partner shall pay a penalty of three months earnings if they join any competing platform within one year.

4. The Company may change the rate card and these terms at any time at its sole discretion without notice.

5. The Partner is responsible for their own vehicle maintenance and fuel.

6. Payments will be settled to the Partner's account every week.`
  },
  {
    id: 'ca-job',
    label: 'California job offer',
    kind: 'Employment',
    jurisdiction: 'US-CA',
    counterparty: 'Westbay Tech Inc',
    text: `EMPLOYMENT OFFER LETTER

1. Your annual salary will be $72,000, paid twice monthly.

2. This salary covers all hours worked and you are not entitled to overtime pay regardless of hours.

3. You agree to a non-compete clause and shall not work for any competitor for two years after leaving.

4. The security deposit for company equipment is non-refundable under all circumstances.

5. You are entitled to 12 paid vacation days per year, accrued monthly.

6. Either party may end employment with two weeks notice.`
  }
]
