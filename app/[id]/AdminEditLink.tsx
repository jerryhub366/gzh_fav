'use client';

import { useEffect, useState } from 'react';
import { getAdminSession } from '../../lib/adminClient';

export default function AdminEditLink({ id }: { id: string }) {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let active = true;

    getAdminSession().then((session) => {
      if (active) setCanEdit(session.admin);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!canEdit) return null;

  return (
    <div className="mb-4 flex justify-end">
      <a href={`/${id}/edit`} className="text-sm text-blue-600 hover:underline">
        Edit
      </a>
    </div>
  );
}
