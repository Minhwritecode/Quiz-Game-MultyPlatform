import { sanitizeEvent } from './privacy';

test('drops note text, credentials, user details, breadcrumb payloads and query strings', () => {
  const safe = sanitizeEvent({ message: 'secret-note', user: {email:'private@email.test'}, request:{headers:{Authorization:'Bearer token'}}, extra:{sourceText:'secret-note'}, breadcrumbs:[{message:'password'}], exception:{values:[{value:'secret-note',stacktrace:{frames:[{filename:'https://host/index.js?token=private',lineno:12,vars:{token:'private'},context_line:'secret-note'}]}}]} });
  const serialized=JSON.stringify(safe);
  for(const word of ['secret-note','private','password','Authorization','Bearer'])expect(serialized).not.toContain(word);
  expect(safe.exception?.values?.[0]?.stacktrace?.frames?.[0]).toMatchObject({filename:'index.js',lineno:12});
});
