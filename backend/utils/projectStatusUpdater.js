const { db } = require('../firebase-admin');

/**
 * Auto-update pending invitation/contract projects past due date to invitation_expired
 * This can be called periodically or on-demand
 */
async function autoRejectOverduePendingProjects() {
  try {
    console.log('[INFO] Checking for overdue pending invitation projects...');
    
    const now = new Date();
    const projectsRef = db.collection('projects');
    
    // Query for pending invitation/contract projects
    const pendingStatuses = ['pending_invitation', 'pending_contract'];
    
    let updatedCount = 0;
    
    for (const status of pendingStatuses) {
      const snapshot = await projectsRef
        .where('status', '==', status)
        .get();
      
      if (snapshot.empty) {
        console.log(`[INFO] No projects with status: ${status}`);
        continue;
      }
      
      // Process each project
      const batch = db.batch();
      let batchCount = 0;
      
      snapshot.forEach((doc) => {
        const project = doc.data();
        
        // Check if project has a due date and it's past
        if (project.dueDate) {
          let dueDate;
          
          // Handle Firestore Timestamp
          if (project.dueDate.toDate) {
            dueDate = project.dueDate.toDate();
          } else if (typeof project.dueDate === 'string') {
            dueDate = new Date(project.dueDate);
          } else if (project.dueDate instanceof Date) {
            dueDate = project.dueDate;
          }
          
          // If due date is past, mark as invitation_expired
          if (dueDate && !isNaN(dueDate.getTime()) && dueDate < now) {
            console.log(`[WARN] Auto-expiring project ${doc.id} (${project.title}) - due date ${dueDate.toISOString()} has passed`);
            
            batch.update(doc.ref, {
              status: 'invitation_expired',
              expiredReason: 'Contract not signed by due date',
              autoExpiredAt: now.toISOString(),
              previousStatus: status,
            });
            
            batchCount++;
            updatedCount++;
          }
        }
      });
      
      // Commit batch if there are updates
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[SUCCESS] Updated ${batchCount} projects with status: ${status}`);
      }
    }
    
    console.log(`[SUCCESS] Auto-expiration check complete. Total projects updated: ${updatedCount}`);
    return { success: true, updatedCount };
    
  } catch (error) {
    console.error('[ERROR] Error auto-expiring overdue pending projects:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-update active projects past due date to overdue status
 */
async function autoMarkOverdueActiveProjects() {
  try {
    console.log('[INFO] Checking for overdue active projects...');
    
    const now = new Date();
    const projectsRef = db.collection('projects');
    
    const snapshot = await projectsRef
      .where('status', '==', 'active')
      .get();
    
    if (snapshot.empty) {
      console.log('[INFO] No active projects to check');
      return { success: true, updatedCount: 0 };
    }
    
    const batch = db.batch();
    let updatedCount = 0;
    
    snapshot.forEach((doc) => {
      const project = doc.data();
      
      if (project.dueDate) {
        let dueDate;
        
        // Handle Firestore Timestamp
        if (project.dueDate.toDate) {
          dueDate = project.dueDate.toDate();
        } else if (typeof project.dueDate === 'string') {
          dueDate = new Date(project.dueDate);
        } else if (project.dueDate instanceof Date) {
          dueDate = project.dueDate;
        }
        
        // If due date is past, mark as overdue
        if (dueDate && !isNaN(dueDate.getTime()) && dueDate < now) {
          console.log(`[WARN] Marking project ${doc.id} (${project.title}) as overdue`);
          
          batch.update(doc.ref, {
            status: 'overdue',
            markedOverdueAt: now.toISOString(),
            previousStatus: 'active',
          });
          
          updatedCount++;
        }
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`[SUCCESS] Marked ${updatedCount} projects as overdue`);
    }
    
    return { success: true, updatedCount };
    
  } catch (error) {
    console.error('[ERROR] Error marking overdue active projects:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  autoRejectOverduePendingProjects,
  autoMarkOverdueActiveProjects,
};
