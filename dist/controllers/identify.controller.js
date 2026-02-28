"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identifyController = void 0;
const prisma_1 = require("../db/prisma");
const identifyController = async (req, res, next) => {
    try {
        const { email, phoneNumber } = req.body;
        // 1. Sanitize inputs
        const emailStr = email ? String(email) : null;
        const phoneStr = phoneNumber ? String(phoneNumber) : null;
        if (!emailStr && !phoneStr) {
            return res
                .status(400)
                .json({ error: "Either email or phoneNumber must be provided." });
        }
        // 2. Find any existing contacts that match the email OR phone
        const matchingContacts = await prisma_1.prisma.contact.findMany({
            where: {
                OR: [{ email: emailStr || null }, { phoneNumber: phoneStr || null }],
            },
        });
        // CASE 1: Completely new customer
        if (matchingContacts.length === 0) {
            const newContact = await prisma_1.prisma.contact.create({
                data: {
                    email: emailStr,
                    phoneNumber: phoneStr,
                    linkPrecedence: "primary",
                },
            });
            return res.status(200).json({
                contact: {
                    primaryContactId: newContact.id,
                    emails: newContact.email ? [newContact.email] : [],
                    phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                    secondaryContactIds: [],
                },
            });
        }
        // 3. Gather all related contacts to form the "Cluster"
        // We need to find the root primary IDs to ensure we get the whole family tree
        const rootPrimaryIds = new Set();
        matchingContacts.forEach((contact) => {
            rootPrimaryIds.add(contact.linkedId ? contact.linkedId : contact.id);
        });
        let cluster = await prisma_1.prisma.contact.findMany({
            where: {
                OR: [
                    { id: { in: Array.from(rootPrimaryIds) } },
                    { linkedId: { in: Array.from(rootPrimaryIds) } },
                ],
            },
            orderBy: { createdAt: "asc" }, // Sort oldest first
        });
        // 4. Identify the oldest primary contact
        const primaries = cluster.filter((c) => c.linkPrecedence === "primary");
        const oldestPrimary = primaries[0];
        // CASE 2: Merging accounts (Primary turns into Secondary)
        // If we matched multiple primaries (e.g., new request links two previously separate accounts)
        if (primaries.length > 1 && oldestPrimary) {
            const primariesToDemote = primaries.slice(1);
            for (const p of primariesToDemote) {
                // Demote the newer primary to secondary
                await prisma_1.prisma.contact.update({
                    where: { id: p.id },
                    data: { linkPrecedence: "secondary", linkedId: oldestPrimary.id },
                });
                // Reparent all of its existing secondary children to the new oldest primary
                await prisma_1.prisma.contact.updateMany({
                    where: { linkedId: p.id },
                    data: { linkedId: oldestPrimary?.id },
                });
            }
            // Re-fetch the cluster to get the updated, merged state
            cluster = await prisma_1.prisma.contact.findMany({
                where: {
                    OR: [{ id: oldestPrimary.id }, { linkedId: oldestPrimary.id }],
                },
                orderBy: { createdAt: "asc" },
            });
        }
        // CASE 3: Create a new Secondary Contact
        // If the request contains new information that wasn't in the cluster yet
        const existingEmails = new Set(cluster.map((c) => c.email).filter(Boolean));
        const existingPhones = new Set(cluster.map((c) => c.phoneNumber).filter(Boolean));
        const isNewEmail = emailStr && !existingEmails.has(emailStr);
        const isNewPhone = phoneStr && !existingPhones.has(phoneStr);
        if ((isNewEmail || isNewPhone) && emailStr && phoneStr) {
            const newSecondary = await prisma_1.prisma.contact.create({
                data: {
                    email: emailStr,
                    phoneNumber: phoneStr,
                    linkedId: oldestPrimary?.id ? oldestPrimary?.id : null,
                    linkPrecedence: "secondary",
                },
            });
            cluster.push(newSecondary); // Add to current cluster for response formatting
        }
        // 5. Format the Response Data
        const emails = new Set();
        const phoneNumbers = new Set();
        const secondaryContactIds = [];
        // Ensure the primary contact's email/phone are always first in the arrays
        if (oldestPrimary?.email)
            emails.add(oldestPrimary.email);
        if (oldestPrimary?.phoneNumber)
            phoneNumbers.add(oldestPrimary.phoneNumber);
        // Add the rest
        cluster.forEach((c) => {
            if (c.email)
                emails.add(c.email);
            if (c.phoneNumber)
                phoneNumbers.add(c.phoneNumber);
            if (c.id !== oldestPrimary?.id) {
                secondaryContactIds.push(c.id);
            }
        });
        return res.status(200).json({
            contact: {
                primaryContactId: oldestPrimary?.id || null,
                emails: Array.from(emails),
                phoneNumbers: Array.from(phoneNumbers),
                secondaryContactIds: secondaryContactIds,
            },
        });
    }
    catch (error) {
        console.error("Error in /identify:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.identifyController = identifyController;
//# sourceMappingURL=identify.controller.js.map