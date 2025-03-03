import { Node } from './types.js'
import * as child from 'child_process';

export function startNode(node:Node, boostrapNode:boolean) {
    let childArguments: string[] = ["run", "-d", "--name", node.id, node.dockerImage,
        "-url", "tcp://host.docker.internal:1883", "-id", node.id, "-energyCommunityId", node.energyCommunity]

    if (boostrapNode) {
        childArguments.push("-l")
        childArguments.push("-b")
    } else if (node.leaderElectionParticipant) {
        childArguments.push("-l")
    }

    child.spawn("docker", childArguments)
}

export function stopNode(id: string) {
    child.execSync(`docker stop ${id}`)
    child.execSync(`docker rm ${id}`)
}