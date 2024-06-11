import { $ } from "bun";

type Issue = { issueNumber: number, title: string, description: string, comments: { user: string, body: string }[], nlp: any }

async function getGithubIssue(index: number): Promise<any> {
    try {
        const response = await fetch('https://api.github.com/repos/hackclub/hcb/issues/' + index, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }).then((res) => res.json())

        // check if it has the Unscrubbed label
        if (!response.labels.some((label: any) => label.name === 'Unscrubbed')) {
            return { pass: true }
        } else {
            // check if it has the Contains PII label
            if (response.labels.some((label: any) => label.name === 'Contains PII')) {
                return { pass: true }
            }
        }

        const comments = await fetch('https://api.github.com/repos/hackclub/hcb/issues/' + index + '/comments', {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }).then((res) => res.json())

        return {
            title: response.title,
            description: response.body,
            comments: comments.map((comment: any) => ({ user: comment.user.login, body: comment.body })),
        }
    } catch (e) {
        console.error(e)
        return { failed: true }
    }
}

async function processBlock() {
    const issueStart = Number(await prompt('Enter the issue number to start from: '));
    const issueEnd = Number(await prompt('Enter the issue number to end at: '));

    let problematicIssues: Issue[] = [];

    for (let i = issueStart; i <= issueEnd; i++) {
        const issue = await getGithubIssue(i);
        if (issue.failed) {
            console.log(`Issue ${i} failed to fetch!`);
            // wait for 5 seconds before trying again
            await new Promise((resolve) => setTimeout(resolve, 5000));
            i--;
            continue;
        } else if (issue.pass) {
            console.log(`Issue ${i} has already been scrubbed!`);
            continue;
        }

        // send the issue to the NLP model as a text string
        const nlp = await (await fetch('http://127.0.0.1:5000/scan', {
            method: 'POST',
            body: JSON.stringify({ data: issue.title + '\n' + issue.description + '\n' + issue.comments.map((comment: { body: any }) => comment.body).join('\n') }),
            headers: {
                'Content-Type': 'application/json',
            },
        })).json();

        if (Object.keys(nlp).length === 0) {
            console.log(`Issue ${i} is clean!`);
            // remove the "Unscrubbed" label from the issue
            await fetch(`https://api.github.com/repos/hackclub/hcb/issues/${i}/labels/Unscrubbed`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            console.log(`Progress: ${Math.round((i - issueStart) / (issueEnd - issueStart) * 100)}%`);
            continue;
        } else {
            console.log(`Issue ${i} is problematic!`);
            problematicIssues.push({
                issueNumber: i,
                ...issue,
                nlp: nlp,
            });
        }

        // display a progress bar
        console.log(`Progress: ${Math.round((i - issueStart) / (issueEnd - issueStart) * 100)}%`);
    }

    return problematicIssues;
}

const processed = await processBlock();
console.log('Processed all issues!');

// for issues that are problematic, open them as a new tab in the browser
for (const issue of processed) {
    console.log(`Opening issue ${issue.issueNumber} in browser...`);
    await $`firefox -new-tab https://github.com/hackclub/hcb/issues/${issue.issueNumber}`;
}