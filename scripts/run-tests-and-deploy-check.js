
#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Lancement de la suite de tests Jest...'));
console.log('');

try {
  // Exécuter les tests Jest
  const testResult = execSync('pnpm test', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log(chalk.green('✅ Tests Jest OK — prêt pour déploiement'));
  console.log('');
  console.log(chalk.dim('Résultat des tests :'));
  console.log(testResult);
  
} catch (error) {
  console.log(chalk.red('❌ Tests KO'));
  console.log('');
  console.log(chalk.red('Première erreur détectée :'));
  console.log(error.stdout || error.message);
  console.log('');
  
  if (error.stderr) {
    console.log(chalk.yellow('Détails supplémentaires :'));
    console.log(error.stderr);
  }
}

console.log(chalk.cyan('📋 RAPPEL IMPORTANT :'));
console.log('');
console.log(chalk.yellow('Après validation des tests, n\'oubliez pas de redéployer toutes les edge functions :'));
console.log('');
console.log(chalk.bold.white('supabase functions deploy --all'));
console.log('');
console.log(chalk.dim('Cette commande est cruciale pour que les nouvelles configurations'));
console.log(chalk.dim('et corrections soient appliquées sur l\'environnement de production.'));
