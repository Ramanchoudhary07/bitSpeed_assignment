import { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma";

export const identifyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { email, phoneNumber } = req.body;

    const emailStr = email ? String(email) : null;
    const phoneStr = phoneNumber ? String(phoneNumber) : null;

    if (!emailStr && !phoneStr) {
      return res
        .status(400)
        .json({ error: "Either email or phoneNumber must be provided." });
    }

    const matchingContacts = await prisma.contact.findMany({
      where: {
        OR: [{ email: emailStr || null }, { phoneNumber: phoneStr || null }],
      },
    });

    if (matchingContacts.length === 0) {
      const newContact = await prisma.contact.create({
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

    const rootPrimaryIds = new Set<number>();
    matchingContacts.forEach((contact) => {
      rootPrimaryIds.add(contact.linkedId ? contact.linkedId : contact.id);
    });

    let relatedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: { in: Array.from(rootPrimaryIds) } },
          { linkedId: { in: Array.from(rootPrimaryIds) } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const primaries = relatedContacts.filter(
      (c) => c.linkPrecedence === "primary",
    );
    const oldestPrimary = primaries[0];

    if (primaries.length > 1 && oldestPrimary) {
      const primariesToDemote = primaries.slice(1);

      for (const p of primariesToDemote) {
        await prisma.contact.update({
          where: { id: p.id },
          data: { linkPrecedence: "secondary", linkedId: oldestPrimary.id },
        });

        await prisma.contact.updateMany({
          where: { linkedId: p.id },
          data: { linkedId: oldestPrimary?.id },
        });
      }

      relatedContacts = await prisma.contact.findMany({
        where: {
          OR: [{ id: oldestPrimary.id }, { linkedId: oldestPrimary.id }],
        },
        orderBy: { createdAt: "asc" },
      });
    }

    const existingEmails = new Set(
      relatedContacts.map((c) => c.email).filter(Boolean),
    );
    const existingPhones = new Set(
      relatedContacts.map((c) => c.phoneNumber).filter(Boolean),
    );

    const isNewEmail = emailStr && !existingEmails.has(emailStr);
    const isNewPhone = phoneStr && !existingPhones.has(phoneStr);

    if ((isNewEmail || isNewPhone) && emailStr && phoneStr) {
      const newSecondary = await prisma.contact.create({
        data: {
          email: emailStr,
          phoneNumber: phoneStr,
          linkedId: oldestPrimary?.id ? oldestPrimary?.id : null,
          linkPrecedence: "secondary",
        },
      });
      relatedContacts.push(newSecondary);
    }

    const emails = new Set<string>();
    const phoneNumbers = new Set<string>();
    const secondaryContactIds: number[] = [];

    if (oldestPrimary?.email) emails.add(oldestPrimary.email);
    if (oldestPrimary?.phoneNumber) phoneNumbers.add(oldestPrimary.phoneNumber);

    relatedContacts.forEach((c) => {
      if (c.email) emails.add(c.email);
      if (c.phoneNumber) phoneNumbers.add(c.phoneNumber);
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
  } catch (error) {
    console.error("Error in /identify:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
