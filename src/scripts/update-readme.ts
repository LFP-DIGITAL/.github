import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

type Repo = RestEndpointMethodTypes['repos']['listForOrg']['response']['data'][number];

const ORG_NAME = 'LFP-DIGITAL';
const README_PATH = path.join(__dirname, '../../profile/README.md');
const LOCAL_ASSETS_DIR = path.join(__dirname, '../../assets');
const COLUMNS = 3;

function classifyRepo(repo: Repo): 'BACK' | 'FRONT' | 'OTHER' {
  const name = repo.name.toLowerCase();
  const topics = (repo.topics || []).map((t: string) => t.toLowerCase());

  if (name.includes('back') || name.includes('api') || name.includes('worker') || name.includes('service'))
    return 'BACK';
  if (topics.includes('backend') || topics.includes('api')) return 'BACK';

  if (name.includes('front') || name.includes('web') || name.includes('ui') || name.includes('app')) return 'FRONT';
  if (topics.includes('frontend') || topics.includes('ui')) return 'FRONT';

  return 'OTHER';
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

function generateGrid(repos: Repo[]): string {
  if (repos.length === 0) return '\n\n*Aucun projet public dans cette catégorie pour le moment.*\n\n';

  const cardsHtml = repos.map((repo) => {
    const bannerUrl = (repo as any).computedImageUrl;

    const lang = repo.language || '';
    const stars = (repo as any).stargazers_count > 0 ? ` · ⭐ ${repo.stargazers_count}` : '';
    const metaInfo = lang ? `<code>${lang}</code>${stars}` : `${stars}`;

    // DESIGN DE LA CARD
    return `<td width="33%" valign="top">
      <a href="${repo.html_url}">
        <img src="${bannerUrl}" alt="${repo.name}" width="100%" style="border-radius: 6px;" />
      </a>
      <br />
      <h3 align="center">
        <a href="${repo.html_url}">${repo.name}</a>
      </h3>
      <p align="center">
         ${metaInfo}
      </p>
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
      finalUrl = `./../assets/${imageName}`;
    } else {
      finalUrl = `https://placehold.co/600x300/1e293b/FFF?text=${encodeURIComponent(repo.name)}`;
    }
    return { ...repo, computedImageUrl: finalUrl };
  });

  const backRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'BACK');
  const frontRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'FRONT');
  const otherRepos = enrichedRepos.filter((r) => classifyRepo(r) === 'OTHER');

  console.info(`📊 Stats: ${backRepos.length} Backend | ${frontRepos.length} Frontend | ${otherRepos.length} Autres`);

  const newContent = `# Bienvenue chez LFP DIGITAL 👋

Nous construisons des solutions numériques pour le football professionnel.

## 🛠 Tech Stack
![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## 🧱 Backend & APIs

${generateGrid(backRepos)}

## 💻 Frontend & Interfaces

${generateGrid(frontRepos)}

## 🔧 Outils & Libs

${generateGrid(otherRepos)}

---
*Dernière mise à jour automatique le : ${new Date().toLocaleDateString('fr-FR')}*
`;

  fs.writeFileSync(README_PATH, newContent);
  console.info(`🚀 ${README_PATH} régénéré !`);
}

run().catch(console.error);
