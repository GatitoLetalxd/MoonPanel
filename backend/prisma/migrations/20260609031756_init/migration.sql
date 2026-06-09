-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('RUNNING', 'STOPPED', 'CREATING', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "webPort" INTEGER NOT NULL,
    "sshPort" INTEGER NOT NULL,
    "sshPassword" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'STOPPED',
    "ramLimit" INTEGER NOT NULL DEFAULT 512,
    "cpuLimit" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "diskLimit" INTEGER NOT NULL DEFAULT 2048,
    "containerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSHKey" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SSHKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_userId_key" ON "Instance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_subdomain_key" ON "Instance"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_webPort_key" ON "Instance"("webPort");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_sshPort_key" ON "Instance"("sshPort");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_containerName_key" ON "Instance"("containerName");

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSHKey" ADD CONSTRAINT "SSHKey_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
