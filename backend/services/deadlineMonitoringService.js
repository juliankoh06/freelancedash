const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { sendDeadlineNotificationEmail } = require('./emailService');

/**
 * Check for projects that have passed their deadline
 * This should be run as a scheduled task (daily)
 */
async function checkOverdueProjects() {
  console.log(' Starting deadline monitoring check...');

  try {
    const now = admin.firestore.Timestamp.now();
    const nowDate = now.toDate();

    // Find active projects with deadlines that have passed
    const projectsSnapshot = await db.collection('projects')
      .where('status', '==', 'active')
      .get();

    let overdueCount = 0;
    let processedCount = 0;

    for (const doc of projectsSnapshot.docs) {
      const project = { id: doc.id, ...doc.data() };

      // Skip if no deadline set
      if (!project.deadline) continue;

      const deadlineDate = project.deadline.toDate ? project.deadline.toDate() : new Date(project.deadline);

      // Check if deadline has passed
      if (deadlineDate < nowDate) {
        processedCount++;

        // Calculate days overdue
        const daysOverdue = Math.floor(
          (nowDate - deadlineDate) / (1000 * 60 * 60 * 24)
        );

        // Check if already marked as overdue
        const alreadyMarked = project.isOverdue === true;

        // Update project status
        await db.collection('projects').doc(project.id).update({
          isOverdue: true,
          daysOverdue: daysOverdue,
          overdueDetectedAt: alreadyMarked ? project.overdueDetectedAt : now,
          updatedAt: now
        });

        // Send notifications only if newly detected or every 7 days
        const shouldNotify = !alreadyMarked || (daysOverdue % 7 === 0);

        if (shouldNotify) {
          await notifyOverdueProject(project, daysOverdue, alreadyMarked);
          overdueCount++;
        }

        console.log(`⚠️ Project "${project.title}" (${project.id}) is ${daysOverdue} days overdue`);
      } else if (project.isOverdue === true) {
        // Project was overdue but deadline was extended, clear overdue flag
        await db.collection('projects').doc(project.id).update({
          isOverdue: false,
          daysOverdue: 0,
          updatedAt: now
        });
        console.log(`✅ Project "${project.title}" (${project.id}) deadline extended, cleared overdue status`);
      }
    }

    console.log(`✅ Deadline check complete. Processed: ${processedCount}, New notifications: ${overdueCount}`);
    return { success: true, processed: processedCount, notified: overdueCount };

  } catch (error) {
    console.error('❌ Error checking overdue projects:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notifications for overdue project
 */
async function notifyOverdueProject(project, daysOverdue, isReminder = false) {
  try {
    const notificationType = isReminder ? 'overdue_reminder' : 'overdue_initial';

    // Get freelancer details
    let freelancerEmail = null;
    let freelancerName = 'Freelancer';

    if (project.freelancerId) {
      try {
        const freelancerDoc = await db.collection('users').doc(project.freelancerId).get();
        if (freelancerDoc.exists) {
          const freelancerData = freelancerDoc.data();
          freelancerEmail = freelancerData.email;
          freelancerName = freelancerData.username || freelancerData.displayName || freelancerEmail;
        }
      } catch (err) {
        console.warn('Could not fetch freelancer details:', err.message);
      }
    }

    // Count incomplete milestones
    let incompleteMilestones = 0;
    if (project.milestones && Array.isArray(project.milestones)) {
      incompleteMilestones = project.milestones.filter(m =>
        m.status !== 'approved' && m.status !== 'paid' && m.status !== 'invoiced'
      ).length;
    }

    // Notify Freelancer
    if (freelancerEmail) {
      await notifyFreelancerOverdue(project, freelancerEmail, freelancerName, daysOverdue, incompleteMilestones, isReminder);
    }

    // Notify Client
    if (project.clientEmail) {
      await notifyClientOverdue(project, freelancerName, daysOverdue, incompleteMilestones, isReminder);
    } else if (project.clientId) {
      // Try to get client email from users collection
      try {
        const clientDoc = await db.collection('users').doc(project.clientId).get();
        if (clientDoc.exists) {
          const clientEmail = clientDoc.data().email;
          await notifyClientOverdue(project, freelancerName, daysOverdue, incompleteMilestones, isReminder);
        }
      } catch (err) {
        console.warn('Could not fetch client details:', err.message);
      }
    }

    console.log(`📧 Overdue notifications sent for project: ${project.title}`);

  } catch (error) {
    console.error('Error sending overdue notifications:', error);
  }
}

/**
 * Notify freelancer about overdue project
 */
async function notifyFreelancerOverdue(project, email, name, daysOverdue, incompleteMilestones, isReminder) {
  try {
    // Create in-app notification
    await db.collection('notifications').add({
      userId: project.freelancerId,
      projectId: project.id,
      type: isReminder ? 'project_overdue_reminder' : 'project_overdue',
      title: isReminder ? 'Project Still Overdue' : 'Project Overdue',
      message: `Project "${project.title}" is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. ${incompleteMilestones} milestone${incompleteMilestones !== 1 ? 's' : ''} pending completion.`,
      createdAt: admin.firestore.Timestamp.now(),
      priority: 'high'
    });

    // Send email using centralized service
    await sendDeadlineNotificationEmail({
      clientEmail: email,
      clientName: name,
      title: project.title,
      deadline: project.dueDate || project.deadline
    }, 'overdue');
    console.log(`✅ Freelancer overdue email sent to ${email}`);

  } catch (error) {
    console.error('Error notifying freelancer:', error);
  }
}

/**
 * Notify client about overdue project
 */
async function notifyClientOverdue(project, freelancerName, daysOverdue, incompleteMilestones, isReminder) {
  try {
    // Create in-app notification if client has userId
    if (project.clientId) {
      await db.collection('notifications').add({
        userId: project.clientId,
        projectId: project.id,
        type: isReminder ? 'project_overdue_client_reminder' : 'project_overdue_client',
        title: isReminder ? 'Project Deadline Status' : 'Project Deadline Exceeded',
        message: `Project "${project.title}" has exceeded its deadline by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}. ${incompleteMilestones} milestone${incompleteMilestones !== 1 ? 's' : ''} remain incomplete.`,
        createdAt: admin.firestore.Timestamp.now(),
        priority: 'medium'
      });
    }

    // Send email using centralized service
    await sendDeadlineNotificationEmail({
      clientEmail: project.clientEmail,
      clientName: project.clientName,
      title: project.title,
      deadline: project.dueDate || project.deadline
    }, isReminder ? 'approaching' : 'overdue');
    console.log(`✅ Client overdue email sent to ${project.clientEmail}`);

  } catch (error) {
    console.error('Error notifying client:', error);
  }
}


/**
 * Get summary of all overdue projects (for admin/reporting)
 */
async function getOverdueProjectsSummary() {
  try {
    const snapshot = await db.collection('projects')
      .where('isOverdue', '==', true)
      .get();

    const overdueProjects = snapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      freelancerId: doc.data().freelancerId,
      clientEmail: doc.data().clientEmail,
      daysOverdue: doc.data().daysOverdue,
      deadline: doc.data().deadline,
      status: doc.data().status
    }));

    return {
      total: overdueProjects.length,
      projects: overdueProjects
    };
  } catch (error) {
    console.error('Error getting overdue projects summary:', error);
    return { total: 0, projects: [] };
  }
}

module.exports = {
  checkOverdueProjects,
  notifyOverdueProject,
  getOverdueProjectsSummary
};
