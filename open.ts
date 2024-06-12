import { $ } from "bun"

const issueStart = Number(await prompt('Enter the issue number to start from: '));
const issueEnd = Number(await prompt('Enter the issue number to end at: '));

for (let i = issueStart; i <= issueEnd; i++) {
    const response = await fetch('https://api.github.com/repos/hackclub/hcb/issues/' + i, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
            'X-GitHub-Api-Version': '2022-11-28'
        }
    }).then((res) => res.json())

    // check if it has the Unscrubbed label
    if (!response.labels.some((label: any) => label.name === 'Unscrubbed')) {
        continue;
    } else {
        // check if it has the Contains PII label
        if (response.labels.some((label: any) => label.name === 'Contains PII')) {
            continue; 1
        }
    }

    await $`firefox -new-tab https://github.com/hackclub/hcb/issues/${i}`;
}