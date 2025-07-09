import { Node, Sensor, GRIDSENSORASSIGNMENT } from './types.js'
import * as child from 'child_process';

export function startNode(node:Node, boostrapNode:boolean) {
    let childArguments: string[] = ["run", "--add-host=host.docker.internal:host-gateway", "-d", "--name", node.id, node.dockerImage,
        "-url", "tcp://host.docker.internal:1883", "-id", node.id, "-sensorId", node.gridSensorAssignment, "-energyCommunityId", node.energyCommunity]    

    if (boostrapNode) {
        childArguments.push("-l")
        childArguments.push("-b")
    } else if (node.leaderElectionParticipant) {
        childArguments.push("-l")
    }

    child.spawn("docker", childArguments)
}

export function startSensor(sensor:Sensor, boostrapNode:boolean) {
    stopContainer(sensor.id)
    let childArguments: string[] = ["run", "--add-host=host.docker.internal:host-gateway", "-d", "--name", sensor.id, sensor.dockerImage,
        "-url", "tcp://host.docker.internal:1883", "-id", sensor.id, "-limit", String(sensor.powerLimit)]    

    if (boostrapNode) {
        childArguments.push("-l")
        childArguments.push("-b")
    } else if (sensor.leaderElectionParticipant) {
        childArguments.push("-l")
    }

    if (sensor.gridSensorAssignment != GRIDSENSORASSIGNMENT.UNASSIGNED) {
        childArguments.push("-parentId")
        childArguments.push(sensor.gridSensorAssignment)
    }

    child.spawn("docker", childArguments)
}

export function stopContainer(id: string) {
    try {
        child.execSync(`docker stop ${id}`)
        child.execSync(`docker rm -f ${id}`)
    } catch (error) {
        console.error(`Error stopping container ${id}:`, error);
     }
}