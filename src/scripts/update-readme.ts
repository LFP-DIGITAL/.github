import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

type Repo = RestEndpointMethodTypes['repos']['listForOrg']['response']['data'][number];

const ORG_NAME = 'LFP-DIGITAL';
const README_PATH = path.join(__dirname, '../../profile/README.md');
const LOCAL_ASSETS_DIR = path.join(__dirname, '../../assets');
const COLUMNS = 3;

function classifyRepo(repo: Repo): 'backend' | 'frontend' | 'tools' | 'modules' | 'types' {
  const topics = (repo.topics || []).map((t: string) => t.toLowerCase());

  if (topics.includes('tools')) return 'tools';
  if (topics.includes('modules')) return 'modules';
  if (topics.includes('types')) return 'types';
  if (topics.includes('backend')) return 'backend';
  if (topics.includes('frontend')) return 'frontend';

  // Fallback basé sur le nom si aucun topic ne correspond
  const name = repo.name.toLowerCase();
  if (name.includes('tools') || name.includes('tool')) return 'tools';
  if (name.includes('modules') || name.includes('module')) return 'modules';
  if (name.includes('types') || name.includes('type')) return 'types';
  if (name.includes('back') || name.includes('api') || name.includes('worker') || name.includes('service'))
    return 'backend';
  if (name.includes('front') || name.includes('web') || name.includes('ui') || name.includes('app')) return 'frontend';

  return 'tools'; // Par défaut
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

function getTextColor(repo: Repo): string {
  const topics = (repo.topics || []).map((t: string) => t.toLowerCase());
  const name = repo.name.toLowerCase();

  if (topics.includes('mpg') || name.includes('mpg')) return '#6dc758'; // vert
  if (topics.includes('mpp') || name.includes('mpp')) return '#295ef6'; // bleu
  if (topics.includes('l1') || name.includes('l1')) return '#085fff'; // violet
  if (topics.includes('slack') || name.includes('slack')) return '#421847'; // violet

  return ''; // Pas de couleur spécifique
}

function getBackgroundColor(repo: Repo): string {
  const topics = (repo.topics || []).map((t: string) => t.toLowerCase());
  const name = repo.name.toLowerCase();

  if (topics.includes('mpg') || name.includes('mpg')) return '6dc758'; // vert (sans #)
  if (topics.includes('mpp') || name.includes('mpp')) return '295ef6'; // bleu (sans #)
  if (topics.includes('l1') || name.includes('l1')) return '085fff'; // violet (sans #)
  if (topics.includes('slack') || name.includes('slack')) return '421847'; // violet

  return '1e293b'; // Couleur par défaut (sans #)
}

function generateGrid(repos: Repo[]): string {
  if (repos.length === 0) return '\n\n*Aucun projet public dans cette catégorie pour le moment.*\n\n';

  const cardsHtml = repos.map((repo) => {
    const bannerUrl = (repo as any).computedImageUrl;

    const lang = repo.language || '';
    const stars = (repo as any).stargazers_count > 0 ? ` · ⭐ ${repo.stargazers_count}` : '';
    const metaInfo = lang ? `<code>${lang}</code>${stars}` : `${stars}`;

    const textColor = getTextColor(repo);
    const linkColor = textColor || '#0969da';
    // Utiliser un span stylé à l'intérieur du lien pour éviter les styles GitHub par défaut
    const linkStyle = `style="text-decoration: none !important; border: none !important; background: none !important; padding: 0 !important; margin: 0 !important; color: transparent !important; display: inline-block !important;"`;
    const spanStyle = `style="color: ${linkColor} !important; font-size: 1.25em !important; font-weight: 600 !important; text-decoration: none !important; cursor: pointer !important; display: inline-block !important;"`;

    // DESIGN DE LA CARD
    return `<td width="33%" valign="top">
      <a href="${repo.html_url}">
        <img src="${bannerUrl}" alt="${repo.name}" width="100%" style="border-radius: 6px;" />
      </a>
      <br />
      <div align="center" style="font-size: 1.25em; font-weight: 600; margin: 0.67em 0;">
        <a href="${repo.html_url}" ${linkStyle}><span ${spanStyle}>${repo.name}</span></a>
      </div>${metaInfo ? `\n<p align="center">${metaInfo}</p>` : ''}
    </td>`;
  });

  const rows = chunkArray(cardsHtml, COLUMNS);

  let tableContent = '<table>\n';
  rows.forEach((row) => {
    tableContent += '  <tr>\n';
    row.forEach((cell) => {
      tableContent += `    ${cell}\n`;
    });
    if (row.length < COLUMNS) {
      for (let i = 0; i < COLUMNS - row.length; i++) tableContent += "    <td width='33%'></td>\n";
    }
    tableContent += '  </tr>\n';
  });
  tableContent += '</table>';

  return tableContent;
}

async function run() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  console.info(`🔍 Lecture des repos de ${ORG_NAME}...`);
  const { data: repos } = await octokit.rest.repos.listForOrg({
    org: ORG_NAME,
    sort: 'full_name',
    direction: 'desc',
    per_page: 100,
    type: 'all',
  });

  const activeRepos = repos.filter((r) => !r.archived && r.name !== '.github');

  console.info(`📁 Dossier images cible : ${LOCAL_ASSETS_DIR}`);
  if (!fs.existsSync(LOCAL_ASSETS_DIR)) {
    console.warn(`⚠️  ATTENTION: Le dossier ${LOCAL_ASSETS_DIR} n'existe pas !`);
  }

  const enrichedRepos = activeRepos.map((repo) => {
    const imageName = `${repo.name}.png`;
    const localImagePath = path.join(LOCAL_ASSETS_DIR, imageName);

    const hasImage = fs.existsSync(localImagePath);

    let finalUrl;
    if (hasImage) {
      finalUrl = `../assets/${imageName}`;
    } else {
      const bgColor = getBackgroundColor(repo);
      const cleanName = repo.name
        .replace(/^back-modules-/, '')
        .replace(/^back-tools-/, '')
        .replace(/^back-types-/, '')
        .replace(/^back-/, '')
        .replace(/^back-modules-/, '');
      finalUrl = `https://placehold.co/600x300/${bgColor}/FFF?text=${encodeURIComponent(cleanName)}`;
    }
    return { ...repo, computedImageUrl: finalUrl };
  });

  const toolsRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'tools');
  const modulesRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'modules');
  const typesRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'types');
  const backendRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'backend');
  const frontendRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'frontend');

  console.info(
    `📊 Stats: ${backendRepos.length} Backend | ${frontendRepos.length} Frontend | ${toolsRepos.length} Tools | ${modulesRepos.length} Modules | ${typesRepos.length} Types`,
  );

  const newContent = `# Bienvenue chez LFP DIGITAL 👋

Nous construisons des solutions numériques pour le football professionnel.

## 🛠 Tech Stack
![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## 🧱 Backend

${generateGrid(backendRepos)}

## 💻 Frontend

${generateGrid(frontendRepos)}

## 🔧 Tools

${generateGrid(toolsRepos)}

## 📦 Modules

${generateGrid(modulesRepos)}

## 📚 Types

${generateGrid(typesRepos)}

---
*Dernière mise à jour automatique le : ${new Date().toLocaleDateString('fr-FR')}*

<div align="right">
  <a href="https://github.com/LFP-DIGITAL/.github/actions/workflows/update-readme.yml" style="text-decoration: none !important; border: none !important; background: #0969da !important; color: white !important; padding: 8px 16px !important; border-radius: 6px !important; font-weight: 600 !important; display: inline-block !important; cursor: pointer !important;">
    🔄 Refresh
  </a>
</div>
`;

  fs.writeFileSync(README_PATH, newContent);
  console.info(`🚀 ${README_PATH} régénéré !`);
}

run().catch(console.error);
