/** Checks the Git index: never prints a matched credential. Not a history audit. */
const { execFileSync } = require('node:child_process');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const forbidden =
  /(^|\/)(node_modules|\.expo|\.claude|\.vscode|evidence|recordings|data)(\/|$)|(^|\/)(credentials\.json|google-services\.json|GoogleService-Info\.plist|AGENTS\.md|CLAUDE[^/]*|Memory\.md|\.env(?:\..*)?)$|\.(csv|edf|fif|p12|p8|key|keystore|jks|mobileprovision)$/i;
const secret =
  /gh[pousr]_[A-Za-z0-9]{24,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const problems = [];
for (const file of files) {
  if (forbidden.test(file)) problems.push(file + ': archivo privado o generado');
  if (
    !/\.(png|jpg|ttf|woff2?)$/i.test(file) &&
    secret.test(
      execFileSync('git', ['show', `:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }),
    )
  )
    problems.push(file + ': posible credencial');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Revisión pública: ${files.length} archivos; sin coincidencias en las reglas de privacidad.`,
  );
